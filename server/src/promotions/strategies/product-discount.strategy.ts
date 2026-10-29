import { IDiscountStrategy, CartPricingContext, CartLineContext } from './discount-strategy.interface';
import { PromoScope } from '../../invoices/pricing';

export class ProductDiscountStrategy implements IDiscountStrategy {
  public readonly id: string;
  public readonly code: string;
  public readonly name: string;
  public readonly scope: PromoScope = 'product';
  public readonly discountType: 'percentage' | 'fixed_amount';
  public readonly value: number;
  public readonly productIds: string[];
  public readonly maxDiscountAmount: number | null;
  public readonly minOrderValue: number;
  public readonly requiresCode: boolean;

  constructor(params: {
    id: string;
    code: string;
    name: string;
    discountType: 'percentage' | 'fixed_amount';
    value: number;
    productIds: string[];
    maxDiscountAmount?: number | null;
    minOrderValue?: number;
    requiresCode?: boolean;
  }) {
    this.id = params.id;
    this.code = params.code;
    this.name = params.name;
    this.discountType = params.discountType;
    this.value = params.value;
    this.productIds = params.productIds ?? [];
    this.maxDiscountAmount = params.maxDiscountAmount ?? null;
    this.minOrderValue = params.minOrderValue ?? 0;
    this.requiresCode = params.requiresCode ?? false;
  }

  public isEligible(context: CartPricingContext): boolean {
    // R5: Giảm giá cố định (fixed_amount) bị bỏ qua ở cấp dòng
    if (this.discountType !== 'percentage') return false;
    if (context.subtotal < this.minOrderValue) return false;
    if (this.requiresCode) {
      if (!context.voucherCode || context.voucherCode.toUpperCase() !== this.code.toUpperCase()) {
        return false;
      }
    }
    return true;
  }

  public calculateLineDiscount(line: CartLineContext, _context: CartPricingContext): number {
    if (this.discountType !== 'percentage') return 0;
    if (!this.productIds.includes(line.productId)) {
      return 0;
    }
    return Math.floor((line.subtotal * this.value) / 100);
  }
}
