import { BadRequestException } from '@nestjs/common';

/**
 * Bộ tính giá bán hàng - thuần logic, KHÔNG đụng DB để test độc lập.
 *   1. allocateFefo : chia số lượng khách mua vào các lô (hết hạn trước, xuất trước)
 *   2. priceRows    : tính giảm giá riêng của sản phẩm + khuyến mãi (tự động + mã voucher)
 *   3. settlePayments : chốt các khoản thanh toán, tiền thừa, phương thức
 * Tiền là VND nên mọi khoản giảm giá được làm tròn về số nguyên.
 */

export type PayMethod = 'cash' | 'transfer' | 'card';

export interface ProductInfo {
  id: string;
  code: string;
  name: string;
  unit: string;
  category: string;
  sellingPrice: number;
  discountPercent: number; // 0 nếu không giảm riêng
}

export interface BatchInfo {
  id: string;
  batchCode: string;
  productId: string;
  expiryDate: Date;
  quantity: number;
}

export interface PromoInfo {
  id: string;
  code: string;
  name: string;
  scope: 'order' | 'category' | 'product' | 'near_expiry';
  discountType: 'percentage' | 'fixed_amount';
  value: number;
  maxDiscountAmount: number | null;
  startDate: Date;
  endDate: Date;
  minOrderValue: number;
  applicableCategory: string | null;
  nearExpiryDays: number | null;
  requiresCode: boolean;
  usageLimit: number | null;
  usedCount: number;
  status: string;
  productIds: string[];
}

/** 1 dòng hóa đơn = 1 sản phẩm lấy từ 1 lô */
export interface PricedRow {
  productId: string;
  category: string;
  batchId: string;
  batchCode: string;
  expiryDate: Date;
  quantity: number;
  unitPrice: number;
  /** giảm giá riêng của sản phẩm (tổng của dòng) */
  productDiscount: number;
  /** giảm giá từ khuyến mãi được phân bổ vào dòng */
  promoDiscount: number;
}

export interface AppliedPromo {
  promotionId: string;
  code: string;
  name: string;
  discountAmount: number;
}

export interface PricingResult {
  rows: PricedRow[];
  subtotal: number; // tổng tiền hàng theo giá niêm yết
  productDiscount: number;
  promoDiscount: number;
  discountAmount: number; // productDiscount + promoDiscount
  finalTotal: number;
  applied: AppliedPromo[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Giá giảm riêng trên 1 đơn vị (làm tròn VND) */
export const unitProductDiscount = (unitPrice: number, discountPercent: number) =>
  discountPercent > 0 ? Math.round((unitPrice * discountPercent) / 100) : 0;

// ───────────────────────── 1. Phân bổ lô (FEFO) ─────────────────────────

export function allocateFefo(
  lines: { productId: string; quantity: number }[],
  products: Map<string, ProductInfo>,
  batches: BatchInfo[],
  now: Date,
): PricedRow[] {
  // Gộp các dòng trùng sản phẩm
  const wanted = new Map<string, number>();
  for (const l of lines) wanted.set(l.productId, (wanted.get(l.productId) ?? 0) + l.quantity);

  const rows: PricedRow[] = [];
  for (const [productId, qty] of wanted) {
    const product = products.get(productId);
    if (!product) throw new BadRequestException('Sản phẩm không tồn tại');

    const usable = batches
      .filter((b) => b.productId === productId && b.quantity > 0 && b.expiryDate.getTime() > now.getTime())
      .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime() || a.batchCode.localeCompare(b.batchCode));

    const available = usable.reduce((s, b) => s + b.quantity, 0);
    if (available < qty) {
      throw new BadRequestException(
        `Sản phẩm "${product.name}" không đủ tồn kho (cần ${qty}, còn bán được ${available})`,
      );
    }

    const perUnitDiscount = unitProductDiscount(product.sellingPrice, product.discountPercent);
    let remaining = qty;
    for (const b of usable) {
      if (remaining <= 0) break;
      const take = Math.min(b.quantity, remaining);
      rows.push({
        productId,
        category: product.category,
        batchId: b.id,
        batchCode: b.batchCode,
        expiryDate: b.expiryDate,
        quantity: take,
        unitPrice: product.sellingPrice,
        productDiscount: perUnitDiscount * take,
        promoDiscount: 0,
      });
      remaining -= take;
    }
  }
  return rows;
}

// ───────────────────────── 2. Khuyến mãi ─────────────────────────

const rowGross = (r: PricedRow) => r.unitPrice * r.quantity;
const rowNet = (r: PricedRow) => rowGross(r) - r.productDiscount - r.promoDiscount;

/** Lý do không áp dụng được, null = áp dụng được */
function promoRejectReason(p: PromoInfo, now: Date, subtotal: number): string | null {
  if (p.status !== 'active') return 'Chương trình khuyến mãi không còn hoạt động';
  if (now.getTime() < p.startDate.getTime()) return 'Chương trình khuyến mãi chưa bắt đầu';
  if (now.getTime() > p.endDate.getTime()) return 'Chương trình khuyến mãi đã kết thúc';
  if (p.usageLimit != null && p.usedCount >= p.usageLimit) return 'Mã khuyến mãi đã hết lượt sử dụng';
  if (subtotal < p.minOrderValue) {
    return `Đơn hàng phải từ ${p.minOrderValue.toLocaleString('vi-VN')} đ để áp dụng khuyến mãi này`;
  }
  return null;
}

function eligibleRows(p: PromoInfo, rows: PricedRow[], now: Date): PricedRow[] {
  switch (p.scope) {
    case 'order':
      return rows;
    case 'category':
      return rows.filter((r) => r.category === p.applicableCategory);
    case 'product':
      return rows.filter((r) => p.productIds.includes(r.productId));
    case 'near_expiry': {
      const days = p.nearExpiryDays ?? 0;
      return rows.filter(
        (r) =>
          (r.expiryDate.getTime() - now.getTime()) / DAY_MS <= days &&
          (p.productIds.length === 0 || p.productIds.includes(r.productId)),
      );
    }
  }
}

export function priceRows(
  inputRows: PricedRow[],
  promos: PromoInfo[],
  voucherCode: string | undefined,
  now: Date,
): PricingResult {
  const rows = inputRows.map((r) => ({ ...r }));
  const subtotal = rows.reduce((s, r) => s + rowGross(r), 0);
  const applied: AppliedPromo[] = [];

  const code = voucherCode?.trim().toUpperCase() || undefined;
  const voucher = code ? promos.find((p) => p.code.toUpperCase() === code) : undefined;
  if (code && !voucher) {
    throw new BadRequestException('Mã khuyến mãi không hợp lệ hoặc chương trình không còn hoạt động');
  }

  // Tự động: chương trình không cần mã, xếp theo ngày bắt đầu rồi theo mã để kết quả ổn định
  const auto = promos
    .filter((p) => !p.requiresCode && p.id !== voucher?.id)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime() || a.code.localeCompare(b.code));
  const queue: { promo: PromoInfo; isVoucher: boolean }[] = [
    ...auto.map((promo) => ({ promo, isVoucher: false })),
    ...(voucher ? [{ promo: voucher, isVoucher: true }] : []),
  ];

  for (const { promo, isVoucher } of queue) {
    const reason = promoRejectReason(promo, now, subtotal);
    const eligible = reason ? [] : eligibleRows(promo, rows, now);
    const base = eligible.reduce((s, r) => s + rowNet(r), 0);

    if (reason || base <= 0) {
      // Voucher khách nhập mà không dùng được -> báo lỗi; chương trình tự động -> bỏ qua
      if (isVoucher) {
        throw new BadRequestException(reason ?? 'Mã khuyến mãi không áp dụng cho sản phẩm nào trong đơn');
      }
      continue;
    }

    let discount =
      promo.discountType === 'percentage' ? Math.round((base * promo.value) / 100) : Math.round(promo.value);
    if (promo.discountType === 'percentage' && promo.maxDiscountAmount != null) {
      discount = Math.min(discount, Math.round(promo.maxDiscountAmount));
    }
    discount = Math.min(discount, base);
    if (discount <= 0) continue;

    // Phân bổ theo tỷ lệ giá trị còn lại của từng dòng; dòng cuối nhận phần dư
    let left = discount;
    eligible.forEach((r, i) => {
      const share = i === eligible.length - 1 ? left : Math.min(left, Math.round((discount * rowNet(r)) / base));
      r.promoDiscount += share;
      left -= share;
    });

    applied.push({ promotionId: promo.id, code: promo.code, name: promo.name, discountAmount: discount });
  }

  const productDiscount = rows.reduce((s, r) => s + r.productDiscount, 0);
  const promoDiscount = rows.reduce((s, r) => s + r.promoDiscount, 0);
  return {
    rows,
    subtotal,
    productDiscount,
    promoDiscount,
    discountAmount: productDiscount + promoDiscount,
    finalTotal: Math.max(0, subtotal - productDiscount - promoDiscount),
    applied,
  };
}

// ───────────────────────── 3. Thanh toán ─────────────────────────

export interface PaymentInput {
  method: PayMethod;
  amount: number; // tiền mặt = số khách đưa; chuyển khoản/thẻ = số tiền giao dịch
  reference?: string;
}

export interface SettledPayments {
  rows: { method: PayMethod; amount: number; reference?: string }[];
  paymentMethod: PayMethod | 'mixed';
  receivedAmount: number; // tổng khách đưa
  changeAmount: number; // tiền thối (chỉ tiền mặt)
}

export function settlePayments(finalTotal: number, inputs: PaymentInput[]): SettledPayments {
  const sum = (m: PayMethod) => inputs.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0);
  const cashGiven = sum('cash');
  const transfer = sum('transfer');
  const card = sum('card');
  const nonCash = transfer + card;

  for (const p of inputs) {
    if ((p.method === 'transfer' || p.method === 'card') && p.amount > 0 && !p.reference?.trim()) {
      throw new BadRequestException(
        p.method === 'transfer'
          ? 'Vui lòng nhập mã giao dịch chuyển khoản để xác nhận đã nhận tiền'
          : 'Vui lòng nhập mã chuẩn chi thẻ',
      );
    }
  }
  if (nonCash > finalTotal) {
    throw new BadRequestException('Tổng chuyển khoản + thẻ không được vượt quá số tiền phải trả');
  }
  const received = cashGiven + nonCash;
  if (received < finalTotal) {
    throw new BadRequestException('Số tiền thanh toán chưa đủ để hoàn tất hóa đơn');
  }

  const change = received - finalTotal; // luôn <= cashGiven vì nonCash <= finalTotal
  const cashApplied = cashGiven - change;

  const rows: SettledPayments['rows'] = [];
  if (cashApplied > 0) rows.push({ method: 'cash', amount: cashApplied });
  for (const p of inputs) {
    if (p.method !== 'cash' && p.amount > 0) {
      rows.push({ method: p.method, amount: p.amount, reference: p.reference!.trim() });
    }
  }
  // Hóa đơn 0đ (giảm giá hết) không có khoản thanh toán nào; còn lại phải có ít nhất 1 khoản
  if (rows.length === 0 && finalTotal > 0) {
    throw new BadRequestException('Hóa đơn phải có ít nhất một khoản thanh toán');
  }

  const methods = new Set(rows.map((r) => r.method));
  return {
    rows,
    paymentMethod: methods.size > 1 ? 'mixed' : (rows[0]?.method ?? 'cash'),
    receivedAmount: received,
    changeAmount: change,
  };
}
