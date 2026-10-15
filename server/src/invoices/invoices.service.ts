import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import {
  ApproveInvoiceDto,
  CreateInvoiceDto,
  PreviewInvoiceDto,
  QueryInvoiceDto,
} from './dto/invoice.dto';
import {
  PricingResult,
  ProductInfo,
  PromoInfo,
  allocateFefo,
  priceRows,
  settlePayments,
} from './invoice-pricing';

type Db = Prisma.TransactionClient | PrismaService;

const INVOICE_INCLUDE = {
  staff: { select: { id: true, code: true, name: true } },
  invoice_items: {
    include: {
      products: { select: { code: true, name: true, unit: true } },
      batches: { select: { batchCode: true } },
    },
  },
  invoice_payments: true,
  invoice_promotions: { include: { promotions: { select: { code: true, name: true } } } },
  invoice_approvals: true,
} satisfies Prisma.invoicesInclude;

const isUniqueViolation = (e: unknown, field: string) =>
  e instanceof Prisma.PrismaClientKnownRequestError &&
  e.code === 'P2002' &&
  String(e.meta?.target ?? '').includes(field);

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotions: PromotionsService,
  ) {}

  // ───────────────────────── Tính tiền ─────────────────────────

  /** Đọc sản phẩm, lô, khuyến mãi rồi tính giá. Dùng chung cho preview và create. */
  private async buildPricing(db: Db, dto: PreviewInvoiceDto, now: Date) {
    const ids = [...new Set(dto.items.map((i) => i.productId))];
    const productRows = await db.products.findMany({ where: { id: { in: ids } } });
    if (productRows.length !== ids.length) {
      throw new NotFoundException('Có sản phẩm trong giỏ không tồn tại');
    }
    const inactive = productRows.find((p) => p.status !== 'active');
    if (inactive) {
      throw new BadRequestException(`Sản phẩm "${inactive.name}" đã ngừng kinh doanh`);
    }

    const products = new Map<string, ProductInfo>(
      productRows.map((p) => [
        p.id,
        {
          id: p.id,
          code: p.code,
          name: p.name,
          unit: p.unit,
          category: p.category,
          sellingPrice: Number(p.sellingPrice),
          discountPercent: p.discountPercent == null ? 0 : Number(p.discountPercent),
        },
      ]),
    );

    const batches = (
      await db.batches.findMany({
        where: { productId: { in: ids }, quantity: { gt: 0 }, expiryDate: { gt: now } },
      })
    ).map((b) => ({
      id: b.id,
      batchCode: b.batchCode,
      productId: b.productId,
      expiryDate: b.expiryDate,
      quantity: b.quantity,
    }));

    const promos = await this.promotions.findActiveStatus(db);
    const rows = allocateFefo(dto.items, products, batches, now);
    const pricing = priceRows(rows, promos, dto.voucherCode, now);
    return { products, promos, pricing };
  }

  private toPreview(pricing: PricingResult, voucherCode?: string) {
    return {
      items: pricing.rows.map((r) => ({
        productId: r.productId,
        batchId: r.batchId,
        batchCode: r.batchCode,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        discount: r.productDiscount + r.promoDiscount,
        subtotal: r.unitPrice * r.quantity - r.productDiscount - r.promoDiscount,
      })),
      subtotal: pricing.subtotal,
      productDiscount: pricing.productDiscount,
      promotionDiscount: pricing.promoDiscount,
      discountAmount: pricing.discountAmount,
      finalTotal: pricing.finalTotal,
      appliedPromotions: pricing.applied,
      voucherCode: pricing.applied.some((a) => a.code.toUpperCase() === voucherCode?.trim().toUpperCase())
        ? voucherCode!.trim().toUpperCase()
        : undefined,
    };
  }

  /** Tính thử giỏ hàng + khuyến mãi, KHÔNG ghi DB. */
  async preview(dto: PreviewInvoiceDto) {
    const { pricing } = await this.buildPricing(this.prisma, dto, new Date());
    return this.toPreview(pricing, dto.voucherCode);
  }

  // ───────────────────────── Lập hóa đơn + thanh toán ─────────────────────────

  private async nextInvoiceCode(now: Date) {
    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(now)
      .replace(/-/g, '');
    const prefix = `HD-${ymd}-`;
    const last = await this.prisma.invoices.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const lastSeq = last ? parseInt(last.code.slice(prefix.length), 10) : 0;
    const seq = (Number.isNaN(lastSeq) ? 0 : lastSeq) + 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  async create(dto: CreateInvoiceDto, cashierId: string) {
    const cashier = await this.prisma.staff.findUnique({
      where: { id: cashierId },
      select: { id: true, status: true },
    });
    if (!cashier || cashier.status !== 'active') {
      throw new ForbiddenException('Tài khoản thu ngân không hợp lệ hoặc đã bị khóa');
    }

    // Trùng mã hóa đơn do 2 quầy bán cùng lúc: sinh mã lại rồi làm lại cả giao dịch
    for (let attempt = 0; attempt < 5; attempt++) {
      const now = new Date();
      const code = await this.nextInvoiceCode(now);
      try {
        return await this.prisma.$transaction((tx) => this.createInTx(tx, dto, cashierId, code, now), {
          timeout: 20000,
        });
      } catch (e) {
        if (isUniqueViolation(e, 'code')) continue;
        throw e;
      }
    }
    throw new ConflictException('Không thể sinh mã hóa đơn, vui lòng thử lại');
  }

  private async createInTx(
    tx: Prisma.TransactionClient,
    dto: CreateInvoiceDto,
    cashierId: string,
    code: string,
    now: Date,
  ) {
    const { promos, pricing } = await this.buildPricing(tx, dto, now);
    const settled = settlePayments(pricing.finalTotal, dto.payments);

    // Một mã giao dịch chuyển khoản chỉ được dùng cho một hóa đơn còn hiệu lực
    for (const p of settled.rows.filter((r) => r.method === 'transfer')) {
      const dup = await tx.invoice_payments.findFirst({
        where: {
          method: 'transfer',
          reference: p.reference,
          invoices: { status: { in: ['completed', 'pending_payment', 'pending_approval'] } },
        },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException(`Mã giao dịch chuyển khoản "${p.reference}" đã được dùng cho hóa đơn khác`);
      }
    }

    // Trừ kho đúng lô đã phân bổ. updateMany có điều kiện để 2 quầy không bán trùng tồn.
    for (const r of pricing.rows) {
      const res = await tx.batches.updateMany({
        where: { id: r.batchId, quantity: { gte: r.quantity } },
        data: { quantity: { decrement: r.quantity } },
      });
      if (res.count === 0) {
        throw new ConflictException(`Lô ${r.batchCode} vừa hết hàng hoặc không đủ tồn, vui lòng thử lại`);
      }
    }

    // Tăng lượt dùng khuyến mãi (chặn vượt usageLimit khi nhiều quầy cùng dùng)
    const promoById = new Map<string, PromoInfo>(promos.map((p) => [p.id, p]));
    for (const a of pricing.applied) {
      const p = promoById.get(a.promotionId)!;
      const res = await tx.promotions.updateMany({
        where: { id: p.id, ...(p.usageLimit != null && { usedCount: { lt: p.usageLimit } }) },
        data: { usedCount: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictException(`Khuyến mãi ${p.code} đã hết lượt sử dụng`);
    }

    const voucher = dto.voucherCode?.trim().toUpperCase();
    const voucherApplied = voucher && pricing.applied.some((a) => a.code.toUpperCase() === voucher);

    return tx.invoices.create({
      data: {
        code,
        cashierId,
        subtotal: pricing.subtotal,
        discountAmount: pricing.discountAmount,
        voucherCode: voucherApplied ? voucher : null,
        finalTotal: pricing.finalTotal,
        paymentMethod: settled.paymentMethod,
        receivedAmount: settled.receivedAmount,
        changeAmount: settled.changeAmount,
        paidAt: now,
        status: 'completed',
        notes: dto.notes?.trim() || null,
        invoice_items: {
          create: pricing.rows.map((r) => {
            const discount = r.productDiscount + r.promoDiscount;
            return {
              productId: r.productId,
              batchId: r.batchId,
              quantity: r.quantity,
              unitPrice: r.unitPrice,
              discount,
              subtotal: r.unitPrice * r.quantity - discount,
            };
          }),
        },
        invoice_payments: {
          create: settled.rows.map((p) => ({
            method: p.method,
            amount: p.amount,
            status: 'confirmed' as const,
            reference: p.reference ?? null,
            confirmedById: cashierId,
            confirmedAt: now,
          })),
        },
        invoice_promotions: {
          create: pricing.applied.map((a) => ({
            promotionId: a.promotionId,
            discountAmount: a.discountAmount,
          })),
        },
      },
      include: INVOICE_INCLUDE,
    });
  }

  // ───────────────────────── Tra cứu hóa đơn ─────────────────────────

  findAll(query: QueryInvoiceDto) {
    return this.prisma.invoices.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(query.search && { code: { contains: query.search.trim(), mode: 'insensitive' } }),
      },
      include: INVOICE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoices.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice) throw new NotFoundException('Không tìm thấy hóa đơn');
    return invoice;
  }

  // ───────────────────────── Đổi trả / hủy hóa đơn ─────────────────────────

  /**
   * Quản lý duyệt đổi trả hoặc hủy NGUYÊN hóa đơn:
   *  - hóa đơn chuyển sang returned / cancelled
   *  - hoàn lại tồn kho đúng lô đã bán
   *  - trả lại lượt dùng khuyến mãi
   *  - lưu vết duyệt + hoàn tiền vào invoice_approvals
   */
  async approve(
    id: string,
    action: 'return' | 'cancel',
    dto: ApproveInvoiceDto,
    user: { id: string; role: string },
  ) {
    if (dto.refundMethod === 'transfer' && !dto.refundRef?.trim()) {
      throw new BadRequestException('Vui lòng nhập mã giao dịch hoàn tiền chuyển khoản');
    }

    return this.prisma.$transaction(async (tx) => {
      // Kiểm tra quyền theo dữ liệu thật, không tin hoàn toàn vào role trong token
      const approver = await tx.staff.findUnique({
        where: { id: user.id },
        select: { id: true, role: true, status: true },
      });
      if (!approver || approver.status !== 'active' || approver.role !== 'manager') {
        throw new ForbiddenException('Chỉ quản lý mới được duyệt đổi trả / hủy hóa đơn');
      }

      const invoice = await tx.invoices.findUnique({
        where: { id },
        include: { invoice_items: true, invoice_promotions: true },
      });
      if (!invoice) throw new NotFoundException('Không tìm thấy hóa đơn');

      const label = action === 'return' ? 'Đã trả hàng' : 'Đã hủy';
      // Chuyển trạng thái có điều kiện: 2 người cùng bấm thì chỉ một người thành công
      const moved = await tx.invoices.updateMany({
        where: { id, status: 'completed' },
        data: {
          status: action === 'return' ? 'returned' : 'cancelled',
          notes: `${invoice.notes ?? ''} [${label}: ${dto.reason.trim()}]`.trim(),
        },
      });
      if (moved.count === 0) {
        throw new ConflictException('Chỉ hóa đơn đã hoàn tất mới được đổi trả / hủy (có thể đã được xử lý trước đó)');
      }

      for (const item of invoice.invoice_items) {
        if (!item.batchId) continue;
        await tx.batches.update({
          where: { id: item.batchId },
          data: { quantity: { increment: item.quantity } },
        });
      }

      for (const ip of invoice.invoice_promotions) {
        await tx.promotions.updateMany({
          where: { id: ip.promotionId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }

      await tx.invoice_approvals.create({
        data: {
          invoiceId: id,
          action,
          reason: dto.reason.trim(),
          refundAmount: invoice.finalTotal,
          refundMethod: dto.refundMethod,
          refundRef: dto.refundMethod === 'transfer' ? dto.refundRef!.trim() : null,
          approvedById: approver.id,
        },
      });

      return tx.invoices.findUniqueOrThrow({ where: { id }, include: INVOICE_INCLUDE });
    });
  }
}
