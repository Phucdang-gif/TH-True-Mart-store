import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PromoInfo } from '../invoices/invoice-pricing';

type PromoRow = Prisma.promotionsGetPayload<{ include: { promotion_products: true } }>;

export const toPromoInfo = (p: PromoRow): PromoInfo => ({
  id: p.id,
  code: p.code,
  name: p.name,
  scope: p.scope,
  discountType: p.discountType,
  value: Number(p.value),
  maxDiscountAmount: p.maxDiscountAmount == null ? null : Number(p.maxDiscountAmount),
  startDate: p.startDate,
  endDate: p.endDate,
  minOrderValue: Number(p.minOrderValue),
  applicableCategory: p.applicableCategory,
  nearExpiryDays: p.nearExpiryDays,
  requiresCode: p.requiresCode,
  usageLimit: p.usageLimit,
  usedCount: p.usedCount,
  status: p.status,
  productIds: p.promotion_products.map((x) => x.productId),
});

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mọi chương trình có status = active (chưa lọc theo ngày/lượt dùng).
   * Việc kiểm tra ngày, lượt dùng, điều kiện đơn tối thiểu do invoice-pricing xử lý
   * để báo đúng lý do khi thu ngân nhập mã không dùng được.
   */
  async findActiveStatus(db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const rows = await db.promotions.findMany({
      where: { status: 'active' },
      include: { promotion_products: true },
      orderBy: { startDate: 'asc' },
    });
    return rows.map(toPromoInfo);
  }

  /** Các chương trình đang chạy (status = active) và còn trong thời gian hiệu lực. */
  async findRunning(now = new Date(), db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const rows = await db.promotions.findMany({
      where: { status: 'active', startDate: { lte: now }, endDate: { gte: now } },
      include: { promotion_products: true },
      orderBy: { startDate: 'asc' },
    });
    return rows.map(toPromoInfo);
  }

  /** Dữ liệu trả về cho màn hình POS (không lộ thông tin nội bộ) */
  async listForPos() {
    const running = await this.findRunning();
    return running.filter((p) => p.usageLimit == null || p.usedCount < p.usageLimit);
  }
}
