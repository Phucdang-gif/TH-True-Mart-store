import { PricingLine, PricingPromo, PricingResult, PromoRow } from '../../invoices/pricing';
import { PromotionStrategyFactory } from './promotion-strategy.factory';
import { CartPricingContext, CartLineContext, IDiscountStrategy } from './discount-strategy.interface';

/**
 * PricingEngine: Bộ điều phối tính giá hóa đơn và khuyến mãi theo hướng đối tượng (OOAD).
 * Ứng dụng Strategy Pattern để tính chiết khấu linh hoạt cho từng loại khuyến mãi,
 * đảm bảo tuân thủ 15 quy tắc nghiệp vụ của hệ thống TH True Mart.
 */
export class PricingEngine {
  public static calculate(
    lines: PricingLine[],
    promos: PricingPromo[],
    voucherCode?: string | null,
  ): PricingResult {
    const vc = voucherCode?.trim().toUpperCase() || null;

    const cartLines: CartLineContext[] = lines.map((l) => ({
      productId: l.productId,
      categoryCode: l.categoryCode,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      daysToExpiry: l.daysToExpiry,
      subtotal: l.quantity * l.unitPrice,
    }));

    const subtotal = cartLines.reduce((sum, line) => sum + line.subtotal, 0);

    const context: CartPricingContext = {
      lines: cartLines,
      subtotal,
      voucherCode: vc,
    };

    // Khởi tạo các đối tượng Strategy thông qua Factory (Factory Pattern)
    const strategies: IDiscountStrategy[] = promos
      .map((p) => PromotionStrategyFactory.create(p))
      .filter((s) => s.isEligible(context))
      .sort((a, b) => a.code.localeCompare(b.code));

    const isVoucher = (s: IDiscountStrategy) => !!vc && s.code.toUpperCase() === vc;

    // So sánh ưu tiên chiến lược tốt hơn (Quy tắc R7)
    const better = (d: number, s: IDiscountStrategy, cur: { d: number; s: IDiscountStrategy } | null) =>
      !cur || d > cur.d || (d === cur.d && isVoucher(s) && !isVoucher(cur.s));

    // ---- R1: Khuyến mãi cấp dòng (Line Strategies) ----
    const lineWinners: ({ d: number; s: IDiscountStrategy } | null)[] = cartLines.map((line) => {
      let best: { d: number; s: IDiscountStrategy } | null = null;
      for (const s of strategies) {
        if (s.scope === 'order' || !s.calculateLineDiscount) continue;
        const d = s.calculateLineDiscount(line, context);
        if (d > 0 && better(d, s, best)) {
          best = { d, s };
        }
      }
      return best;
    });

    const lineDiscounts = lineWinners.map((w) => w?.d ?? 0);

    // ---- R6: Trần giảm giá theo chương trình (Proration) ----
    const byPromo = new Map<string, number[]>();
    lineWinners.forEach((w, i) => {
      if (w) byPromo.set(w.s.id, [...(byPromo.get(w.s.id) ?? []), i]);
    });

    for (const [, idxs] of byPromo) {
      const s = lineWinners[idxs[0]]!.s;
      if (s.maxDiscountAmount == null) continue;
      const total = idxs.reduce((sum, i) => sum + lineDiscounts[i], 0);
      if (total <= s.maxDiscountAmount) continue;

      let assigned = 0;
      for (const i of idxs) {
        lineDiscounts[i] = Math.floor((lineDiscounts[i] * s.maxDiscountAmount) / total);
        assigned += lineDiscounts[i];
      }

      let remainder = s.maxDiscountAmount - assigned;
      for (const i of idxs) {
        if (remainder <= 0) break;
        const initialDiscount = lineWinners[i]!.d;
        const room = initialDiscount - lineDiscounts[i];
        if (room > 0) {
          lineDiscounts[i] += 1;
          remainder -= 1;
        }
      }
    }

    const rows: PromoRow[] = [];
    lineWinners.forEach((w, i) => {
      if (w && lineDiscounts[i] > 0) {
        rows.push({
          promotionId: w.s.id,
          code: w.s.code,
          name: w.s.name,
          lineIndex: i,
          discountAmount: lineDiscounts[i],
        });
      }
    });

    // ---- R2: Khuyến mãi cấp đơn (Order Strategies) ----
    const lineTotalDiscount = lineDiscounts.reduce((a, b) => a + b, 0);
    const base = subtotal - lineTotalDiscount;

    let orderBest: { d: number; s: IDiscountStrategy } | null = null;
    for (const s of strategies) {
      if (s.scope !== 'order' || !s.calculateOrderDiscount) continue;
      const d = s.calculateOrderDiscount(base, context);
      if (d > 0 && better(d, s, orderBest)) {
        orderBest = { d, s };
      }
    }

    const orderDiscount = orderBest?.d ?? 0;
    if (orderBest) {
      rows.push({
        promotionId: orderBest.s.id,
        code: orderBest.s.code,
        name: orderBest.s.name,
        lineIndex: null,
        discountAmount: orderDiscount,
      });
    }

    const discountAmount = lineTotalDiscount + orderDiscount;
    return {
      subtotal,
      lineDiscounts,
      orderDiscount,
      discountAmount,
      finalTotal: subtotal - discountAmount,
      rows,
    };
  }
}
