import {
  Injectable, BadRequestException, ConflictException, NotFoundException, HttpException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto, PreviewInvoiceDto } from './dto/create-invoice.dto';
import { priceInvoice, PricingLine, PricingPromo, PricingResult } from './pricing';

type Tx = Prisma.TransactionClient;

const INVOICE_INCLUDE = {
  invoice_items: {
    include: {
      products: { select: { code: true, name: true, unit: true } },
      batches: { select: { batchCode: true } },
    },
  },
  invoice_payments: true,
  invoice_promotions: {
    include: { promotions: { select: { code: true, name: true, requiresCode: true } } },
  },
  staff: { select: { name: true, code: true } },
} as const;

const PROMO_INCLUDE = {
  product_categories: { select: { code: true } },
  promotion_products: { select: { productId: true } },
} as const;

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' đ';

interface BatchRow {
  id: string;
  productId: string;
  batchCode: string;
  quantity: number;
  expiryDate: Date;
}

// Một dòng hóa đơn = 1 lô được lấy hàng (1 sản phẩm có thể tách nhiều lô)
interface Allocation {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  batchId: string;
  batchCode: string;
  expiryDate: Date;
  quantity: number;
  unitPrice: number;
}

interface PricedCart {
  allocations: Allocation[];
  pricing: PricingResult;
  promoMeta: Map<string, { id: string; code: string; scope: string; usageLimit: number | null }>;
  now: Date;
}

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Dùng chung cho XEM TRƯỚC và CHỐT HÓA ĐƠN: chọn lô FIFO + tính khuyến mãi.
  // lock = true (khi chốt): khóa các lô bằng SELECT ... FOR UPDATE để 2 quầy không bán cùng một hàng.
  // ---------------------------------------------------------------------------
  private async priceCart(tx: Tx, dto: PreviewInvoiceDto, lock: boolean): Promise<PricedCart> {
    const now = new Date();

    // Gộp các dòng trùng sản phẩm
    const qtyByProduct = new Map<string, number>();
    for (const i of dto.items) {
      qtyByProduct.set(i.productId, (qtyByProduct.get(i.productId) ?? 0) + i.quantity);
    }
    const productIds = [...qtyByProduct.keys()];

    const products = await tx.products.findMany({
      where: { id: { in: productIds } },
      include: { product_categories: { select: { code: true } } },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Có sản phẩm không tồn tại');
    }
    const productById = new Map(products.map((p) => [p.id, p]));
    for (const p of products) {
      if (p.status !== 'active') {
        throw new BadRequestException(`Sản phẩm "${p.name}" đã ngừng kinh doanh`);
      }
    }

    // Lô còn hàng và CHƯA hết hạn, hết hạn sớm nhất lấy trước (FIFO theo hạn dùng)
    const batches = await tx.$queryRaw<BatchRow[]>(Prisma.sql`
      SELECT "id", "productId", "batchCode", "quantity", "expiryDate"
      FROM "batches"
      WHERE "productId" IN (${Prisma.join(productIds)})
        AND "quantity" > 0
        AND "expiryDate" >= ${now}
      ORDER BY "expiryDate" ASC, "createdAt" ASC, "id" ASC
      ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}
    `);

    const allocations: Allocation[] = [];
    for (const [productId, need] of qtyByProduct) {
      const product = productById.get(productId)!;
      const list = batches.filter((b) => b.productId === productId);
      const available = list.reduce((s, b) => s + b.quantity, 0);
      if (available < need) {
        throw new BadRequestException(
          `Sản phẩm "${product.name}" chỉ còn ${available} trong kho (không tính lô hết hạn), không đủ ${need}`,
        );
      }
      let remaining = need;
      for (const b of list) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, b.quantity);
        allocations.push({
          productId,
          productCode: product.code,
          productName: product.name,
          unit: product.unit,
          batchId: b.id,
          batchCode: b.batchCode,
          expiryDate: b.expiryDate,
          quantity: take,
          unitPrice: Number(product.sellingPrice),
        });
        remaining -= take;
      }
    }

    // Chương trình đang hiệu lực: tự chuyển scheduled -> active khi tới ngày, nên cho phép cả 2 trạng thái
    const promoRows = await tx.promotions.findMany({
      where: {
        status: { in: ['active', 'scheduled'] },
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: PROMO_INCLUDE,
    });
    const usable = promoRows.filter((p) => p.usageLimit == null || p.usedCount < p.usageLimit);

    const promos: PricingPromo[] = usable.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      scope: p.scope,
      discountType: p.discountType,
      value: Number(p.value),
      maxDiscountAmount: p.maxDiscountAmount == null ? null : Number(p.maxDiscountAmount),
      minOrderValue: Number(p.minOrderValue),
      categoryCode: p.product_categories?.code ?? null,
      nearExpiryDays: p.nearExpiryDays,
      productIds: p.promotion_products.map((x) => x.productId),
      requiresCode: p.requiresCode,
    }));

    const lines: PricingLine[] = allocations.map((a) => ({
      productId: a.productId,
      categoryCode: productById.get(a.productId)!.product_categories?.code ?? null,
      quantity: a.quantity,
      unitPrice: a.unitPrice,
      daysToExpiry: Math.ceil((a.expiryDate.getTime() - now.getTime()) / 86_400_000),
    }));

    const voucher = dto.voucherCode?.trim().toUpperCase() || undefined;
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    if (voucher) await this.assertVoucherUsable(tx, voucher, subtotal, now);

    const pricing = priceInvoice(lines, promos, voucher);

    if (voucher && !pricing.rows.some((r) => r.code.toUpperCase() === voucher)) {
      throw new BadRequestException(
        `Mã "${voucher}" không áp dụng được cho các sản phẩm trong hóa đơn, hoặc đã có chương trình khác giảm nhiều hơn`,
      );
    }

    return {
      allocations,
      pricing,
      promoMeta: new Map(
        usable.map((p) => [p.id, { id: p.id, code: p.code, scope: p.scope, usageLimit: p.usageLimit }]),
      ),
      now,
    };
  }

  // Báo lỗi rõ ràng cho từng lý do mã không dùng được (UC04)
  private async assertVoucherUsable(tx: Tx, code: string, subtotal: number, now: Date) {
    const v = await tx.promotions.findUnique({ where: { code } });
    if (!v || !v.requiresCode) throw new BadRequestException('Mã giảm giá không tồn tại');
    if (v.status !== 'active' && v.status !== 'scheduled') {
      throw new BadRequestException('Chương trình của mã này không còn hiệu lực');
    }
    if (now < v.startDate) throw new BadRequestException('Mã chưa đến ngày áp dụng');
    if (now > v.endDate) throw new BadRequestException('Mã đã hết hạn');
    if (v.usageLimit != null && v.usedCount >= v.usageLimit) {
      throw new BadRequestException('Mã đã hết lượt sử dụng');
    }
    if (subtotal < Number(v.minOrderValue)) {
      throw new BadRequestException(`Hóa đơn cần tối thiểu ${vnd(Number(v.minOrderValue))} để dùng mã này`);
    }
  }

  // ---------------------------------------------------------------------------
  // XEM TRƯỚC: tính đúng như lúc chốt nhưng KHÔNG ghi gì
  // ---------------------------------------------------------------------------
  async preview(dto: PreviewInvoiceDto) {
    const cart = await this.prisma.$transaction((tx) => this.priceCart(tx, dto, false));
    const { allocations, pricing, promoMeta } = cart;

    const byPromo = new Map<string, { promotionId: string; code: string; name: string; scope: string; discountAmount: number }>();
    for (const r of pricing.rows) {
      const cur = byPromo.get(r.promotionId);
      if (cur) cur.discountAmount += r.discountAmount;
      else {
        byPromo.set(r.promotionId, {
          promotionId: r.promotionId,
          code: r.code,
          name: r.name,
          scope: promoMeta.get(r.promotionId)?.scope ?? 'order',
          discountAmount: r.discountAmount,
        });
      }
    }

    return {
      subtotal: pricing.subtotal,
      discountAmount: pricing.discountAmount,
      finalTotal: pricing.finalTotal,
      lines: allocations.map((a, i) => ({
        productId: a.productId,
        productCode: a.productCode,
        productName: a.productName,
        unit: a.unit,
        batchId: a.batchId,
        batchCode: a.batchCode,
        expiryDate: a.expiryDate.toISOString(),
        quantity: a.quantity,
        unitPrice: a.unitPrice,
        discount: pricing.lineDiscounts[i],
        subtotal: a.quantity * a.unitPrice - pricing.lineDiscounts[i],
      })),
      promotions: [...byPromo.values()],
    };
  }

  // ---------------------------------------------------------------------------
  // CHỐT HÓA ĐƠN: một transaction duy nhất.
  // Lỗi ở bất kỳ bước nào => rollback toàn bộ (không trừ kho, không ghi tiền, không tăng lượt mã).
  // ---------------------------------------------------------------------------
  async create(staffId: string, dto: CreateInvoiceDto) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction((tx) => this.createInTx(tx, staffId, dto, attempt), {
          timeout: 20_000,
          maxWait: 5_000,
        });
      } catch (e: any) {
        // Trùng mã hóa đơn do 2 quầy chốt cùng lúc: thử lại với số kế tiếp
        if (e?.code === 'P2002' && attempt < 2) continue;
        if (e instanceof HttpException) throw e;
        if (String(e?.message ?? '').includes('không đủ tồn')) {
          throw new ConflictException('Tồn kho vừa thay đổi, vui lòng kiểm tra lại giỏ hàng và thử lại');
        }
        throw e;
      }
    }
  }

  private async createInTx(tx: Tx, staffId: string, dto: CreateInvoiceDto, attempt: number) {
    const { allocations, pricing, promoMeta, now } = await this.priceCart(tx, dto, true);
    const finalTotal = pricing.finalTotal;

    // ---- Kiểm tra thanh toán (UC05-UC09) ----
    const payments = dto.payments ?? [];
    const methods = payments.map((p) => p.method);
    if (new Set(methods).size !== methods.length) {
      throw new BadRequestException('Mỗi hình thức thanh toán chỉ được nhập một lần');
    }
    if (finalTotal > 0 && payments.length === 0) {
      throw new BadRequestException('Chưa có thông tin thanh toán');
    }

    let nonCash = 0;
    for (const p of payments) {
      if (p.method === 'cash') continue;
      if (!p.reference?.trim()) {
        throw new BadRequestException(
          p.method === 'transfer'
            ? 'Vui lòng nhập mã giao dịch chuyển khoản (đã nhận tiền)'
            : 'Vui lòng nhập mã chuẩn chi của thẻ',
        );
      }
      nonCash += p.amount;
    }
    if (nonCash > finalTotal) {
      throw new BadRequestException('Tổng chuyển khoản + thẻ vượt quá số tiền phải trả');
    }

    const cash = payments.find((p) => p.method === 'cash');
    const cashDue = finalTotal - nonCash; // phần còn lại phải thu bằng tiền mặt
    let cashReceived = 0;
    if (cashDue > 0) {
      if (!cash || cash.amount < cashDue) {
        throw new BadRequestException(
          `Chưa thu đủ tiền: còn thiếu ${vnd(cashDue - (cash?.amount ?? 0))}`,
        );
      }
      cashReceived = cash.amount;
    } else if (cash) {
      throw new BadRequestException('Hóa đơn đã thanh toán đủ, không nhận thêm tiền mặt');
    }

    // ---- Mã hóa đơn HD-YYYYMMDD-NNN theo ngày giờ Việt Nam ----
    const day = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).replace(/-/g, '');
    const prefix = `HD-${day}-`;
    const todayCount = await tx.invoices.count({ where: { code: { startsWith: prefix } } });
    const code = `${prefix}${String(todayCount + 1 + attempt).padStart(3, '0')}`;

    // ---- Ghi hóa đơn ----
    // Trigger DB (kiểm tra lúc COMMIT): hóa đơn completed phải có khoản thanh toán confirmed >= finalTotal
    const invoice = await tx.invoices.create({
      data: {
        code,
        cashierId: staffId,
        subtotal: pricing.subtotal,
        discountAmount: pricing.discountAmount,
        finalTotal,
        status: 'completed',
        notes: dto.notes?.trim() || null,
        paidAt: now,
      },
    });

    const itemIds: string[] = [];
    for (let i = 0; i < allocations.length; i++) {
      const a = allocations[i];
      const item = await tx.invoice_items.create({
        data: {
          invoiceId: invoice.id,
          productId: a.productId,
          batchId: a.batchId,
          quantity: a.quantity,
          unitPrice: a.unitPrice,
          discount: pricing.lineDiscounts[i],
        },
        select: { id: true },
      });
      itemIds.push(item.id);
    }

    // Tiền mặt ghi theo số THỰC THU (đã trừ tiền thừa), giữ số khách đưa ở cashReceived
    const paymentData: Prisma.invoice_paymentsCreateManyInput[] = [];
    if (cashDue > 0) {
      paymentData.push({
        invoiceId: invoice.id, method: 'cash', amount: cashDue, cashReceived,
        status: 'confirmed', confirmedById: staffId, confirmedAt: now,
      });
    }
    for (const p of payments) {
      if (p.method === 'cash') continue;
      paymentData.push({
        invoiceId: invoice.id, method: p.method, amount: p.amount, reference: p.reference!.trim(),
        status: 'confirmed', confirmedById: staffId, confirmedAt: now,
      });
    }
    if (paymentData.length > 0) await tx.invoice_payments.createMany({ data: paymentData });

    if (pricing.rows.length > 0) {
      await tx.invoice_promotions.createMany({
        data: pricing.rows.map((r) => ({
          invoiceId: invoice.id,
          promotionId: r.promotionId,
          invoiceItemId: r.lineIndex == null ? null : itemIds[r.lineIndex],
          discountAmount: r.discountAmount,
        })),
      });
    }

    // ---- Trừ kho: ghi sổ kho loại 'sale' (số âm); trigger DB tự trừ tồn của lô ----
    await tx.stock_movements.createMany({
      data: allocations.map((a) => ({
        batchId: a.batchId,
        type: 'sale' as const,
        quantity: -a.quantity,
        reason: `Bán hàng ${code}`,
        refType: 'invoice',
        refId: invoice.id,
        createdById: staffId,
      })),
    });

    // ---- Tăng lượt dùng khuyến mãi (mỗi chương trình +1 trên mỗi hóa đơn) ----
    for (const promotionId of new Set(pricing.rows.map((r) => r.promotionId))) {
      const meta = promoMeta.get(promotionId)!;
      if (meta.usageLimit != null) {
        // Điều kiện usedCount < usageLimit nằm ngay trong câu UPDATE nên không bị vượt khi 2 quầy cùng dùng
        const r = await tx.promotions.updateMany({
          where: { id: promotionId, usedCount: { lt: meta.usageLimit } },
          data: { usedCount: { increment: 1 } },
        });
        if (r.count === 0) throw new ConflictException(`Mã "${meta.code}" vừa hết lượt sử dụng`);
      } else {
        await tx.promotions.update({ where: { id: promotionId }, data: { usedCount: { increment: 1 } } });
      }
    }

    const saved = await tx.invoices.findUnique({ where: { id: invoice.id }, include: INVOICE_INCLUDE });
    return saved!;
  }

  // ---------------------------------------------------------------------------
  // Tra cứu
  // ---------------------------------------------------------------------------
  findAll(status?: string) {
    return this.prisma.invoices.findMany({
      where: status ? { status: status as any } : {},
      include: INVOICE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string) {
    const inv = await this.prisma.invoices.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!inv) throw new NotFoundException('Không tìm thấy hóa đơn');
    return inv;
  }
}
