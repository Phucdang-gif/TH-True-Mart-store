import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, PaymentMethod, Prisma, batches, products } from '@prisma/client';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { buildMeta, dateRange, formatVnd, isUniqueViolation, vnDateStamp } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import {
  PricedLine,
  PromotionWithProducts,
  evaluatePromotion,
  getPromotionBlockReason,
} from '../promotions/promotion.utils';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceActionDto } from './dto/invoice-action.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

const ZERO = new Prisma.Decimal(0);
const PROMO_INCLUDE = { promotion_products: { select: { productId: true } } } satisfies Prisma.promotionsInclude;

const INVOICE_INCLUDE = {
  invoice_items: {
    include: {
      products: { select: { id: true, code: true, name: true, unit: true } },
      batches: { select: { id: true, batchCode: true, expiryDate: true } },
    },
  },
  invoice_payments: { orderBy: { createdAt: 'asc' } },
  invoice_approvals: { orderBy: { createdAt: 'asc' } },
  invoice_promotions: { include: { promotions: { select: { id: true, code: true, name: true } } } },
  staff: { select: { id: true, code: true, name: true } },
} satisfies Prisma.invoicesInclude;

type InvoiceWithRelations = Prisma.invoicesGetPayload<{ include: typeof INVOICE_INCLUDE }>;

/** 1 dòng hóa đơn sau khi đã chọn lô và tính giá */
interface Line {
  product: products;
  batch: batches;
  quantity: number;
  unitPrice: Prisma.Decimal;
  /** Giảm giá riêng của sản phẩm TRÊN 1 ĐƠN VỊ (khớp cách frontend tính) */
  unitDiscount: Prisma.Decimal;
  /** (unitPrice - unitDiscount) * quantity */
  net: Prisma.Decimal;
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── Helpers ─────────────────────────

  private toResponse(inv: InvoiceWithRelations) {
    const {
      invoice_items,
      invoice_payments,
      invoice_approvals,
      invoice_promotions,
      staff,
      ...rest
    } = inv;
    return {
      ...rest,
      cashier: staff,
      cashierName: staff.name,
      items: invoice_items.map(({ products, batches, ...item }) => ({
        ...item,
        productCode: products.code,
        productName: products.name,
        unit: products.unit,
        batchCode: batches?.batchCode ?? null,
        batchExpiryDate: batches?.expiryDate ?? null,
      })),
      payments: invoice_payments,
      approvals: invoice_approvals,
      promotions: invoice_promotions.map(({ promotions, ...p }) => ({ ...p, promotion: promotions })),
    };
  }

  /** HD-YYYYMMDD-NNN (theo ngày giờ VN). `offset` dùng khi retry do trùng mã. */
  private async generateCode(offset: number) {
    const prefix = `HD-${vnDateStamp()}-`;
    const count = await this.prisma.invoices.count({ where: { code: { startsWith: prefix } } });
    return `${prefix}${String(count + 1 + offset).padStart(3, '0')}`;
  }

  private assertCanView(inv: { cashierId: string }, user: AuthUser) {
    if (user.role !== 'manager' && inv.cashierId !== user.id) {
      throw new ForbiddenException('Bạn chỉ được xem hóa đơn do mình lập');
    }
  }

  // ───────────────────────── Tạo hóa đơn (bán hàng) ─────────────────────────

  /**
   * Bán hàng tại POS. Toàn bộ trong 1 transaction:
   *  chọn lô (FEFO) -> tính giá/giảm giá -> kiểm tra thanh toán -> lưu hóa đơn -> trừ kho -> ghi lượt dùng khuyến mãi.
   */
  async create(dto: CreateInvoiceDto, user: AuthUser) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await this.generateCode(attempt);
      try {
        const id = await this.prisma.$transaction((tx) => this.createInTx(tx, dto, user, code), {
          timeout: 20000,
        });
        return this.findOne(id, user);
      } catch (e) {
        if (isUniqueViolation(e)) continue; // trùng mã hóa đơn (2 máy bán cùng lúc) -> sinh lại
        throw e;
      }
    }
    throw new ConflictException('Không thể sinh mã hóa đơn duy nhất, vui lòng thử lại');
  }

  private async createInTx(
    tx: Prisma.TransactionClient,
    dto: CreateInvoiceDto,
    user: AuthUser,
    code: string,
  ): Promise<string> {
    const now = new Date();

    // 1. Gộp dòng trùng (cùng sản phẩm + cùng lô); dòng chỉ định lô xử lý trước FEFO tự động
    const merged = new Map<string, { productId: string; batchId?: string; quantity: number }>();
    for (const it of dto.items) {
      const key = `${it.productId}|${it.batchId ?? ''}`;
      const cur = merged.get(key);
      if (cur) cur.quantity += it.quantity;
      else merged.set(key, { productId: it.productId, batchId: it.batchId, quantity: it.quantity });
    }
    const inputs = [...merged.values()].sort((a, b) => Number(!!b.batchId) - Number(!!a.batchId));

    // 2. Sản phẩm
    const productIds = [...new Set(inputs.map((i) => i.productId))];
    const productList = await tx.products.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(productList.map((p) => [p.id, p]));
    for (const id of productIds) {
      const p = productById.get(id);
      if (!p) throw new NotFoundException(`Không tìm thấy sản phẩm ${id}`);
      if (p.status !== 'active') throw new BadRequestException(`Sản phẩm "${p.name}" đã ngừng kinh doanh`);
    }

    // 3. Chọn lô và dựng các dòng hóa đơn
    const taken = new Map<string, number>(); // batchId -> số lượng đã lấy trong đơn này
    const lines: Line[] = [];
    const pushLine = (product: products, batch: batches, quantity: number) => {
      const unitPrice = product.sellingPrice;
      const unitDiscount = product.discountPercent
        ? unitPrice.mul(product.discountPercent).div(100).toDecimalPlaces(2)
        : ZERO;
      lines.push({
        product,
        batch,
        quantity,
        unitPrice,
        unitDiscount,
        net: unitPrice.minus(unitDiscount).mul(quantity),
      });
      taken.set(batch.id, (taken.get(batch.id) ?? 0) + quantity);
    };

    for (const input of inputs) {
      const product = productById.get(input.productId)!;
      if (input.batchId) {
        const batch = await tx.batches.findUnique({ where: { id: input.batchId } });
        if (!batch || batch.productId !== product.id) {
          throw new BadRequestException(`Lô ${input.batchId} không thuộc sản phẩm "${product.name}"`);
        }
        if (batch.expiryDate.getTime() <= now.getTime()) {
          throw new BadRequestException(`Lô ${batch.batchCode} đã hết hạn, không thể bán`);
        }
        const available = batch.quantity - (taken.get(batch.id) ?? 0);
        if (available < input.quantity) {
          throw new BadRequestException(`Lô ${batch.batchCode} chỉ còn ${Math.max(available, 0)}`);
        }
        pushLine(product, batch, input.quantity);
        continue;
      }

      const candidates = await tx.batches.findMany({
        where: { productId: product.id, quantity: { gt: 0 }, expiryDate: { gt: now } },
        orderBy: { expiryDate: 'asc' },
      });
      let remaining = input.quantity;
      for (const b of candidates) {
        if (remaining === 0) break;
        const available = b.quantity - (taken.get(b.id) ?? 0);
        if (available <= 0) continue;
        const take = Math.min(available, remaining);
        pushLine(product, b, take);
        remaining -= take;
      }
      if (remaining > 0) {
        throw new BadRequestException(
          `Không đủ tồn kho cho "${product.name}" (thiếu ${remaining} ${product.unit})`,
        );
      }
    }

    // 4. Tính tiền
    const subtotal = lines.reduce((s, l) => s.plus(l.unitPrice.mul(l.quantity)), ZERO);
    const lineDiscountTotal = lines.reduce((s, l) => s.plus(l.unitDiscount.mul(l.quantity)), ZERO);

    // 5. Khuyến mãi: tối đa 1 chương trình tự động (giảm nhiều nhất) + 1 voucher do thu ngân nhập.
    //    Giá trị tính giảm = thành tiền sau giảm giá riêng của sản phẩm, để không giảm chồng.
    const priced: PricedLine[] = lines.map((l) => ({
      productId: l.product.id,
      category: l.product.category,
      expiryDate: l.batch.expiryDate,
      net: l.net,
    }));
    const applied: { promo: PromotionWithProducts; discount: Prisma.Decimal }[] = [];
    let room = subtotal.minus(lineDiscountTotal); // phần còn có thể giảm

    const autoPromos = await tx.promotions.findMany({
      where: { status: 'active', requiresCode: false, startDate: { lte: now }, endDate: { gte: now } },
      include: PROMO_INCLUDE,
    });
    let bestAuto: { promo: PromotionWithProducts; discount: Prisma.Decimal } | null = null;
    for (const p of autoPromos) {
      if (getPromotionBlockReason(p, now)) continue;
      const r = evaluatePromotion(p, priced, subtotal, now);
      if (r.discount.gt(0) && (!bestAuto || r.discount.gt(bestAuto.discount))) {
        bestAuto = { promo: p, discount: r.discount };
      }
    }
    if (bestAuto) {
      const d = Prisma.Decimal.min(bestAuto.discount, room);
      if (d.gt(0)) {
        applied.push({ promo: bestAuto.promo, discount: d });
        room = room.minus(d);
      }
    }

    let voucherCode: string | null = null;
    if (dto.voucherCode) {
      const promo = await tx.promotions.findFirst({
        where: { code: { equals: dto.voucherCode.trim(), mode: 'insensitive' } },
        include: PROMO_INCLUDE,
      });
      if (!promo) throw new NotFoundException('Mã khuyến mãi không tồn tại');
      if (!promo.requiresCode) {
        throw new BadRequestException('Đây là chương trình tự động áp dụng, không cần nhập mã');
      }
      const blocked = getPromotionBlockReason(promo, now);
      if (blocked) throw new BadRequestException(blocked);

      const r = evaluatePromotion(promo, priced, subtotal, now);
      if (r.discount.lte(0)) throw new BadRequestException(r.reason ?? 'Mã không áp dụng được cho đơn này');
      const d = Prisma.Decimal.min(r.discount, room);
      if (d.lte(0)) throw new BadRequestException('Đơn hàng không còn gì để giảm thêm');
      applied.push({ promo, discount: d });
      room = room.minus(d);
      voucherCode = promo.code;
    }

    const promoDiscountTotal = applied.reduce((s, a) => s.plus(a.discount), ZERO);
    const discountAmount = lineDiscountTotal.plus(promoDiscountTotal);
    const finalTotal = subtotal.minus(discountAmount);

    // 6. Thanh toán (tiền mặt được đưa dư để thối; chuyển khoản/thẻ không được vượt phần phải trả)
    const methods = dto.payments.map((p) => p.method);
    if (new Set(methods).size !== methods.length) {
      throw new BadRequestException('Mỗi hình thức thanh toán chỉ xuất hiện 1 lần');
    }
    const given = (m: string) =>
      new Prisma.Decimal(dto.payments.find((p) => p.method === m)?.amount ?? 0);
    const refOf = (m: string) => dto.payments.find((p) => p.method === m)?.reference?.trim() || null;

    const cashGiven = given('cash');
    const transfer = given('transfer');
    const card = given('card');
    const nonCash = transfer.plus(card);

    if (nonCash.gt(finalTotal)) {
      throw new BadRequestException('Tổng chuyển khoản + thẻ không được vượt quá số tiền phải trả');
    }
    if (transfer.gt(0) && !refOf('transfer')) {
      throw new BadRequestException('Vui lòng nhập mã giao dịch chuyển khoản');
    }
    if (card.gt(0) && !refOf('card')) {
      throw new BadRequestException('Vui lòng nhập mã chuẩn chi thẻ');
    }
    const totalReceived = cashGiven.plus(nonCash);
    if (totalReceived.lt(finalTotal)) {
      throw new BadRequestException(
        `Số tiền thanh toán chưa đủ, còn thiếu ${formatVnd(finalTotal.minus(totalReceived))} đ`,
      );
    }
    const changeAmount = totalReceived.minus(finalTotal);
    const cashApplied = cashGiven.minus(changeAmount); // tiền mặt thực tính vào hóa đơn

    const paymentRows: { method: PaymentMethod; amount: Prisma.Decimal; reference: string | null }[] = [];
    if (cashApplied.gt(0)) paymentRows.push({ method: 'cash', amount: cashApplied, reference: null });
    if (transfer.gt(0)) paymentRows.push({ method: 'transfer', amount: transfer, reference: refOf('transfer') });
    if (card.gt(0)) paymentRows.push({ method: 'card', amount: card, reference: refOf('card') });
    const paymentMethod: PaymentMethod =
      paymentRows.length > 1 ? 'mixed' : (paymentRows[0]?.method ?? 'cash');

    // 7. Ca thu ngân đang mở (nếu có) để đối soát cuối ca
    const session = await tx.cash_sessions.findFirst({
      where: { cashierId: user.id, status: 'open' },
      select: { id: true },
    });

    // 8. Lưu hóa đơn
    const invoice = await tx.invoices.create({
      data: {
        code,
        cashierId: user.id,
        cashSessionId: session?.id ?? null,
        subtotal,
        discountAmount,
        voucherCode,
        finalTotal,
        paymentMethod,
        receivedAmount: totalReceived,
        changeAmount,
        paidAt: now,
        status: 'completed',
        notes: dto.notes,
        invoice_items: {
          createMany: {
            data: lines.map((l) => ({
              productId: l.product.id,
              batchId: l.batch.id,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discount: l.unitDiscount,
              subtotal: l.net,
            })),
          },
        },
        ...(paymentRows.length > 0 && {
          invoice_payments: {
            createMany: {
              data: paymentRows.map((r) => ({
                method: r.method,
                amount: r.amount,
                reference: r.reference,
                status: 'confirmed' as const,
                confirmedById: user.id,
                confirmedAt: now,
              })),
            },
          },
        }),
        ...(applied.length > 0 && {
          invoice_promotions: {
            createMany: {
              data: applied.map((a) => ({ promotionId: a.promo.id, discountAmount: a.discount })),
            },
          },
        }),
      },
      select: { id: true },
    });

    // 9. Trừ kho (điều kiện quantity >= qty chặn bán vượt tồn khi 2 máy bán cùng lúc)
    for (const [batchId, qty] of taken) {
      const res = await tx.batches.updateMany({
        where: { id: batchId, quantity: { gte: qty } },
        data: { quantity: { decrement: qty } },
      });
      if (res.count !== 1) {
        throw new ConflictException('Tồn kho vừa thay đổi do giao dịch khác, vui lòng thử lại');
      }
    }

    // 10. Ghi lượt dùng khuyến mãi (chặn vượt usageLimit khi đồng thời)
    for (const a of applied) {
      const res = await tx.promotions.updateMany({
        where: {
          id: a.promo.id,
          ...(a.promo.usageLimit !== null && { usedCount: { lt: a.promo.usageLimit } }),
        },
        data: { usedCount: { increment: 1 } },
      });
      if (res.count !== 1) {
        throw new ConflictException(`Mã "${a.promo.code}" vừa hết lượt sử dụng`);
      }
    }

    return invoice.id;
  }

  // ───────────────────────── Đọc / sửa ghi chú ─────────────────────────

  async findAll(query: QueryInvoiceDto, user: AuthUser) {
    const { page, limit, search, status, paymentMethod, cashierId, cashSessionId, from, to, sortBy, sortOrder } = query;
    const range = dateRange(from, to);

    const where: Prisma.invoicesWhereInput = {
      ...(status && { status }),
      ...(paymentMethod && { paymentMethod }),
      ...(cashSessionId && { cashSessionId }),
      ...(user.role === 'manager' ? cashierId && { cashierId } : { cashierId: user.id }),
      ...(range && { createdAt: range }),
      ...(search && { code: { contains: search, mode: 'insensitive' } }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoices.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoices.count({ where }),
    ]);
    return { data: rows.map((r) => this.toResponse(r)), meta: buildMeta(total, page, limit) };
  }

  async findOne(id: string, user: AuthUser) {
    const inv = await this.prisma.invoices.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!inv) throw new NotFoundException('Không tìm thấy hóa đơn');
    this.assertCanView(inv, user);
    return this.toResponse(inv);
  }

  async updateNotes(id: string, dto: UpdateInvoiceDto, user: AuthUser) {
    if (dto.notes === undefined) throw new BadRequestException('Không có trường nào để cập nhật');
    const inv = await this.prisma.invoices.findUnique({ where: { id }, select: { cashierId: true } });
    if (!inv) throw new NotFoundException('Không tìm thấy hóa đơn');
    this.assertCanView(inv, user);
    await this.prisma.invoices.update({ where: { id }, data: { notes: dto.notes } });
    return this.findOne(id, user);
  }

  // ───────────────────────── Đổi trả / hủy (quản lý xác nhận) ─────────────────────────

  returnInvoice(id: string, dto: InvoiceActionDto, user: AuthUser) {
    return this.reverse(id, 'return', dto, user);
  }

  cancelInvoice(id: string, dto: InvoiceActionDto, user: AuthUser) {
    return this.reverse(id, 'cancel', dto, user);
  }

  /**
   * - return: chỉ hóa đơn `completed` -> `returned`.
   * - cancel: `completed` / `pending_payment` / `pending_approval` -> `cancelled`; trả lại lượt dùng khuyến mãi.
   * Cả hai: ghi invoice_approvals (lưu vết + hoàn tiền) và (mặc định) cộng hàng về đúng lô đã bán.
   */
  private async reverse(id: string, action: 'return' | 'cancel', dto: InvoiceActionDto, user: AuthUser) {
    const invoice = await this.prisma.invoices.findUnique({
      where: { id },
      include: { invoice_items: true, invoice_payments: true, invoice_promotions: true },
    });
    if (!invoice) throw new NotFoundException('Không tìm thấy hóa đơn');

    const allowed: InvoiceStatus[] =
      action === 'return' ? ['completed'] : ['completed', 'pending_payment', 'pending_approval'];
    if (!allowed.includes(invoice.status)) {
      throw new BadRequestException(
        `Không thể ${action === 'return' ? 'đổi trả' : 'hủy'} hóa đơn ở trạng thái "${invoice.status}"`,
      );
    }

    const paid = invoice.invoice_payments
      .filter((p) => p.status === 'confirmed')
      .reduce((s, p) => s.plus(p.amount), ZERO);
    const refundAmount = new Prisma.Decimal(dto.refundAmount ?? paid);
    if (refundAmount.gt(paid)) {
      throw new BadRequestException(
        `Số tiền hoàn không được vượt số tiền khách đã thanh toán (${formatVnd(paid)} đ)`,
      );
    }

    let refundMethod: PaymentMethod | null = null;
    if (refundAmount.gt(0)) {
      refundMethod = dto.refundMethod ?? (invoice.paymentMethod !== 'mixed' ? invoice.paymentMethod : null);
      if (!refundMethod) {
        throw new BadRequestException('Hóa đơn thanh toán nhiều hình thức, vui lòng chọn refundMethod');
      }
      if (refundMethod !== 'cash' && !dto.refundRef?.trim()) {
        throw new BadRequestException('Hoàn qua chuyển khoản / thẻ cần mã giao dịch hoàn tiền (refundRef)');
      }
    }

    const restock = dto.restock ?? true;

    await this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.invoices.updateMany({
          where: { id, status: invoice.status },
          data: { status: action === 'return' ? 'returned' : 'cancelled' },
        });
        if (claimed.count !== 1) throw new ConflictException('Hóa đơn vừa được xử lý bởi thao tác khác');

        if (restock) {
          for (const item of invoice.invoice_items) {
            if (!item.batchId) continue;
            await tx.batches.update({
              where: { id: item.batchId },
              data: { quantity: { increment: item.quantity } },
            });
          }
        }

        if (action === 'cancel') {
          const promotionIds = [...new Set(invoice.invoice_promotions.map((p) => p.promotionId))];
          for (const promotionId of promotionIds) {
            await tx.promotions.updateMany({
              where: { id: promotionId, usedCount: { gt: 0 } },
              data: { usedCount: { decrement: 1 } },
            });
          }
        }

        await tx.invoice_approvals.create({
          data: {
            invoiceId: id,
            action,
            reason: dto.reason.trim(),
            refundAmount,
            refundMethod,
            refundRef: dto.refundRef?.trim() || null,
            approvedById: user.id,
          },
        });
      },
      { timeout: 15000 },
    );

    return this.findOne(id, user);
  }
}
