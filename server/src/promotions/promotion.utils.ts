import { Category, DiscountType, Prisma, PromotionStatus } from '@prisma/client';
import { DAY_MS, formatVnd } from '../common/utils';

const ZERO = new Prisma.Decimal(0);

export type PromotionWithProducts = Prisma.promotionsGetPayload<{
  include: { promotion_products: { select: { productId: true } } };
}>;

/** Lý do chương trình KHÔNG dùng được lúc này (null = dùng được) */
export function getPromotionBlockReason(
  p: { status: PromotionStatus; startDate: Date; endDate: Date; usageLimit: number | null; usedCount: number },
  now = new Date(),
): string | null {
  if (p.status !== 'active') return 'Chương trình chưa được kích hoạt hoặc đang tạm dừng';
  if (p.startDate.getTime() > now.getTime()) return 'Chương trình chưa bắt đầu';
  if (p.endDate.getTime() < now.getTime()) return 'Chương trình đã kết thúc';
  if (p.usageLimit !== null && p.usedCount >= p.usageLimit) return 'Mã khuyến mãi đã hết lượt sử dụng';
  return null;
}

/** Số tiền giảm trên `base`. Giảm % có trần maxDiscountAmount; giảm tiền mặt không vượt base. */
export function calcPromotionDiscount(
  p: { discountType: DiscountType; value: Prisma.Decimal; maxDiscountAmount: Prisma.Decimal | null },
  base: Prisma.Decimal,
): Prisma.Decimal {
  if (base.lte(0)) return ZERO;
  let discount: Prisma.Decimal;
  if (p.discountType === 'percentage') {
    discount = base.mul(p.value).div(100);
    if (p.maxDiscountAmount) discount = Prisma.Decimal.min(discount, p.maxDiscountAmount);
  } else {
    discount = Prisma.Decimal.min(p.value, base);
  }
  return discount.toDecimalPlaces(2);
}

/** 1 dòng hàng của đơn, `net` = thành tiền sau giảm giá riêng của sản phẩm */
export interface PricedLine {
  productId: string;
  category: Category;
  expiryDate: Date | null;
  net: Prisma.Decimal;
}

/**
 * Tính giảm giá của 1 chương trình cho 1 đơn.
 * Trả về discount = 0 kèm `reason` nếu không áp dụng được.
 */
export function evaluatePromotion(
  promo: PromotionWithProducts,
  lines: PricedLine[],
  grossSubtotal: Prisma.Decimal,
  now = new Date(),
): { discount: Prisma.Decimal; reason?: string } {
  if (grossSubtotal.lt(promo.minOrderValue)) {
    return {
      discount: ZERO,
      reason: `Đơn hàng phải từ ${formatVnd(promo.minOrderValue)} đ để áp dụng "${promo.code}"`,
    };
  }

  const productIds = new Set(promo.promotion_products.map((x) => x.productId));
  const eligible = lines.filter((l) => {
    switch (promo.scope) {
      case 'order':
        return true;
      case 'product':
        return productIds.has(l.productId);
      case 'category':
        return l.category === promo.applicableCategory;
      case 'near_expiry': {
        if (!l.expiryDate || !promo.nearExpiryDays) return false;
        if (productIds.size > 0 && !productIds.has(l.productId)) return false;
        return l.expiryDate.getTime() <= now.getTime() + promo.nearExpiryDays * DAY_MS;
      }
      default:
        return false;
    }
  });

  const base = eligible.reduce((sum, l) => sum.plus(l.net), ZERO);
  const discount = calcPromotionDiscount(promo, base);
  if (discount.lte(0)) {
    return { discount: ZERO, reason: `"${promo.code}" không áp dụng cho các sản phẩm trong đơn` };
  }
  return { discount };
}
