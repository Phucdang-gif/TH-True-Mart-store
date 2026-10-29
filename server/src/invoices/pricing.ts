// Lõi tính giá hóa đơn: Tích hợp Strategy Pattern & Pricing Engine hướng đối tượng (OOAD)
// và cung cấp hàm giao tiếp cho xem trước và chốt hóa đơn.
// Tiền tính bằng số nguyên đồng; giảm theo % làm tròn XUỐNG.
//
// QUY TẮC NGHIỆP VỤ:
//  R1. Mỗi dòng hàng nhận tối đa 1 khuyến mãi cấp dòng (scope product | category | near_expiry): chọn cái giảm nhiều nhất.
//  R2. Cả hóa đơn nhận tối đa 1 khuyến mãi cấp đơn (scope order): chọn cái giảm nhiều nhất,
//      tính trên (tạm tính - tổng giảm cấp dòng).
//  R3. "Đơn tối thiểu" (minOrderValue) so với TẠM TÍNH trước mọi giảm giá.
//  R4. Khuyến mãi requiresCode chỉ tham gia khi thu ngân nhập đúng mã.
//  R5. fixed_amount chỉ có nghĩa ở cấp đơn; ở cấp dòng bị bỏ qua.
//  R6. "Giảm tối đa" (maxDiscountAmount) tính cho cả chương trình trên 1 hóa đơn;
//      nếu các dòng cộng lại vượt trần thì chia lại theo tỷ lệ.
//  R7. Hòa nhau về số tiền giảm: ưu tiên chương trình có mã nhập tay, sau đó theo mã chương trình A-Z.

import { PricingEngine } from '../promotions/strategies/pricing-engine';

export type PromoScope = 'order' | 'category' | 'product' | 'near_expiry';

export interface PricingPromo {
  id: string;
  code: string;
  name: string;
  scope: PromoScope;
  discountType: 'percentage' | 'fixed_amount';
  value: number;
  maxDiscountAmount: number | null;
  minOrderValue: number;
  categoryCode: string | null;
  nearExpiryDays: number | null;
  productIds: string[];
  requiresCode: boolean;
}

export interface PricingLine {
  productId: string;
  categoryCode: string | null;
  quantity: number;
  unitPrice: number;
  daysToExpiry: number; // số ngày còn lại của lô (làm tròn lên)
}

export interface PromoRow {
  promotionId: string;
  code: string;
  name: string;
  lineIndex: number | null; // null = giảm cấp đơn
  discountAmount: number;
}

export interface PricingResult {
  subtotal: number;
  lineDiscounts: number[]; // song song với lines
  orderDiscount: number;
  discountAmount: number; // = tổng lineDiscounts + orderDiscount
  finalTotal: number;
  rows: PromoRow[]; // ghi vào invoice_promotions
}

export function priceInvoice(
  lines: PricingLine[],
  promos: PricingPromo[],
  voucherCode?: string | null,
): PricingResult {
  return PricingEngine.calculate(lines, promos, voucherCode);
}
