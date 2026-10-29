import { IDiscountStrategy, CartPricingContext } from './discount-strategy.interface';
import { PromoScope } from '../../invoices/pricing';

export class OrderDiscountStrategy implements IDiscountStrategy {
  public readonly id: string;
  public readonly code: string;
  public readonly name: string;
  public readonly scope: PromoScope = 'order';
  public readonly discountType: 'percentage' | 'fixed_amount';
  public readonly value: number;
  public readonly maxDiscountAmount: number | null;
  public readonly minOrderValue: number;
  public readonly requiresCode: boolean;

  constructor(params: {
    id: string;
    code: string;
    name: string;
    discountType: 'percentage' | 'fixed_amount';
    value: number;
    maxDiscountAmount?: number | null;
    minOrderValue?: number;
    requiresCode?: boolean;
  }) {
    this.id = params.id;
    this.code = params.code;
    this.name = params.name;
    this.discountType = params.discountType;
    this.value = params.value;
    this.maxDiscountAmount = params.maxDiscountAmount ?? null;
    this.minOrderValue = params.minOrderValue ?? 0;
    this.requiresCode = params.requiresCode ?? false;
  }

  public isEligible(context: CartPricingContext): boolean {
    if (context.subtotal < this.minOrderValue) return false;
    if (this.requiresCode) {
      if (!context.voucherCode || context.voucherCode.toUpperCase() !== this.code.toUpperCase()) {
        return false;
      }
    }
    return true;
  }

  public calculateOrderDiscount(eligibleBase: number, _context: CartPricingContext): number {
    let discount = 0;
    if (this.discountType === 'percentage') {
      discount = Math.floor((eligibleBase * this.value) / 100);
    } else {
      discount = this.value;
    }

    if (this.maxDiscountAmount != null) {
      discount = Math.min(discount, this.maxDiscountAmount);
    }

    return Math.min(discount, eligibleBase);
  }
}
