import { PromoScope } from '../../invoices/pricing';

export interface CartLineContext {
  productId: string;
  categoryCode: string | null;
  quantity: number;
  unitPrice: number;
  daysToExpiry: number;
  subtotal: number;
}

export interface CartPricingContext {
  lines: CartLineContext[];
  subtotal: number;
  voucherCode: string | null;
}

/**
 * Interface trừu tượng cho Chiến lược Giảm giá (Strategy Pattern)
 * Định nghĩa hợp đồng chung cho mọi loại chương trình khuyến mãi của TH True Mart.
 */
export interface IDiscountStrategy {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly scope: PromoScope;
  readonly requiresCode: boolean;
  readonly minOrderValue: number;
  readonly maxDiscountAmount: number | null;

  /**
   * Kiểm tra điều kiện tiên quyết để chiến lược này có thể tham gia xét duyệt
   */
  isEligible(context: CartPricingContext): boolean;

  /**
   * Tính toán số tiền giảm giá cho một dòng sản phẩm cụ thể (nếu là cấp dòng)
   */
  calculateLineDiscount?(line: CartLineContext, context: CartPricingContext): number;

  /**
   * Tính toán số tiền giảm giá cho toàn bộ đơn hàng (nếu là cấp đơn)
   * @param eligibleBase Số tiền cơ sở tính giảm (sau khi đã trừ các khoản giảm cấp dòng)
   */
  calculateOrderDiscount?(eligibleBase: number, context: CartPricingContext): number;
}
