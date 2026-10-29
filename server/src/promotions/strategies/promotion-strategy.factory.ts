import { Injectable } from '@nestjs/common';
import { IDiscountStrategy } from './discount-strategy.interface';
import { OrderDiscountStrategy } from './order-discount.strategy';
import { NearExpiryDiscountStrategy } from './near-expiry-discount.strategy';
import { CategoryDiscountStrategy } from './category-discount.strategy';
import { ProductDiscountStrategy } from './product-discount.strategy';
import { PricingPromo } from '../../invoices/pricing';

/**
 * Factory Pattern: Khởi tạo đối tượng Chiến lược Giảm giá (Strategy) tương ứng
 * dựa vào cấu hình phạm vi (scope) của chương trình khuyến mãi.
 * Giúp mở rộng thêm chiến lược mới mà không sửa đổi mã nguồn xử lý (Open/Closed Principle).
 */
@Injectable()
export class PromotionStrategyFactory {
  public static create(promo: PricingPromo): IDiscountStrategy {
    switch (promo.scope) {
      case 'order':
        return new OrderDiscountStrategy({
          id: promo.id,
          code: promo.code,
          name: promo.name,
          discountType: promo.discountType,
          value: promo.value,
          maxDiscountAmount: promo.maxDiscountAmount,
          minOrderValue: promo.minOrderValue,
          requiresCode: promo.requiresCode,
        });

      case 'near_expiry':
        return new NearExpiryDiscountStrategy({
          id: promo.id,
          code: promo.code,
          name: promo.name,
          discountType: promo.discountType,
          value: promo.value,
          nearExpiryDays: promo.nearExpiryDays ?? 30,
          maxDiscountAmount: promo.maxDiscountAmount,
          minOrderValue: promo.minOrderValue,
          requiresCode: promo.requiresCode,
        });

      case 'category':
        return new CategoryDiscountStrategy({
          id: promo.id,
          code: promo.code,
          name: promo.name,
          discountType: promo.discountType,
          value: promo.value,
          categoryCode: promo.categoryCode || '',
          maxDiscountAmount: promo.maxDiscountAmount,
          minOrderValue: promo.minOrderValue,
          requiresCode: promo.requiresCode,
        });

      case 'product':
        return new ProductDiscountStrategy({
          id: promo.id,
          code: promo.code,
          name: promo.name,
          discountType: promo.discountType,
          value: promo.value,
          productIds: promo.productIds ?? [],
          maxDiscountAmount: promo.maxDiscountAmount,
          minOrderValue: promo.minOrderValue,
          requiresCode: promo.requiresCode,
        });

      default:
        throw new Error(`Phạm vi khuyến mãi không được hỗ trợ: ${promo.scope}`);
    }
  }
}
