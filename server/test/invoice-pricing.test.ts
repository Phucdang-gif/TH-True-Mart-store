/**
 * Test logic tính giá bán hàng (không cần DB):  npx ts-node test/invoice-pricing.test.ts
 */
import { strict as assert } from 'node:assert';
import {
  BatchInfo,
  ProductInfo,
  PromoInfo,
  allocateFefo,
  priceRows,
  settlePayments,
} from '../src/invoices/invoice-pricing';

const NOW = new Date('2026-10-15T03:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86400000);

const milk: ProductInfo = { id: 'p-milk', code: 'MILK', name: 'Sữa dâu', unit: 'Lốc', category: 'SUA_TUOI_TIET_TRUNG', sellingPrice: 38000, discountPercent: 0 };
const yogurt: ProductInfo = { id: 'p-yog', code: 'YOG', name: 'Sữa chua', unit: 'Vỉ', category: 'SUA_CHUA', sellingPrice: 30000, discountPercent: 10 };
const products = new Map([milk, yogurt].map((p) => [p.id, p]));

const batches: BatchInfo[] = [
  { id: 'b-old', batchCode: 'OLD', productId: 'p-milk', expiryDate: day(10), quantity: 3 },
  { id: 'b-new', batchCode: 'NEW', productId: 'p-milk', expiryDate: day(90), quantity: 10 },
  { id: 'b-exp', batchCode: 'EXPIRED', productId: 'p-milk', expiryDate: day(-1), quantity: 50 },
  { id: 'b-yog', batchCode: 'YOG1', productId: 'p-yog', expiryDate: day(20), quantity: 20 },
];

const promo = (o: Partial<PromoInfo>): PromoInfo => ({
  id: 'x', code: 'X', name: 'KM', scope: 'order', discountType: 'fixed_amount', value: 20000,
  maxDiscountAmount: null, startDate: day(-5), endDate: day(5), minOrderValue: 0,
  applicableCategory: null, nearExpiryDays: null, requiresCode: false, usageLimit: null,
  usedCount: 0, status: 'active', productIds: [], ...o,
});

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('  ok  ' + name); };

// ── FEFO ──
t('FEFO: lấy lô hết hạn trước, bỏ qua lô quá hạn, chia nhiều lô', () => {
  const rows = allocateFefo([{ productId: 'p-milk', quantity: 5 }], products, batches, NOW);
  assert.deepEqual(rows.map((r) => [r.batchCode, r.quantity]), [['OLD', 3], ['NEW', 2]]);
});
t('FEFO: gộp 2 dòng trùng sản phẩm', () => {
  const rows = allocateFefo([{ productId: 'p-milk', quantity: 1 }, { productId: 'p-milk', quantity: 1 }], products, batches, NOW);
  assert.equal(rows.reduce((s, r) => s + r.quantity, 0), 2);
});
t('FEFO: không đủ tồn (lô quá hạn không tính) -> lỗi', () => {
  assert.throws(() => allocateFefo([{ productId: 'p-milk', quantity: 14 }], products, batches, NOW), /không đủ tồn kho/);
});

// ── Giá & khuyến mãi ──
t('Giảm giá riêng sản phẩm 10% (làm tròn theo đơn vị)', () => {
  const rows = allocateFefo([{ productId: 'p-yog', quantity: 2 }], products, batches, NOW);
  const r = priceRows(rows, [], undefined, NOW);
  assert.equal(r.subtotal, 60000);
  assert.equal(r.productDiscount, 6000);
  assert.equal(r.finalTotal, 54000);
});
t('Voucher cố định THVIP20K: đủ điều kiện', () => {
  const rows = allocateFefo([{ productId: 'p-milk', quantity: 6 }], products, batches, NOW); // 228k
  const r = priceRows(rows, [promo({ code: 'THVIP20K', requiresCode: true, minOrderValue: 200000 })], 'thvip20k', NOW);
  assert.equal(r.promoDiscount, 20000);
  assert.equal(r.finalTotal, 208000);
  assert.equal(r.rows.reduce((s, x) => s + x.promoDiscount, 0), 20000); // phân bổ đủ vào các dòng
});
t('Voucher: dưới giá trị tối thiểu -> lỗi', () => {
  const rows = allocateFefo([{ productId: 'p-milk', quantity: 2 }], products, batches, NOW);
  assert.throws(() => priceRows(rows, [promo({ code: 'V', requiresCode: true, minOrderValue: 200000 })], 'V', NOW), /phải từ 200\.000/);
});
t('Voucher: mã sai -> lỗi', () => {
  const rows = allocateFefo([{ productId: 'p-milk', quantity: 1 }], products, batches, NOW);
  assert.throws(() => priceRows(rows, [], 'NOPE', NOW), /không hợp lệ/);
});
t('Voucher: hết lượt dùng -> lỗi; chương trình tự động hết lượt -> bỏ qua', () => {
  const rows = allocateFefo([{ productId: 'p-milk', quantity: 1 }], products, batches, NOW);
  const full = { usageLimit: 1, usedCount: 1 };
  assert.throws(() => priceRows(rows, [promo({ code: 'V', requiresCode: true, ...full })], 'V', NOW), /hết lượt/);
  assert.equal(priceRows(rows, [promo({ code: 'AUTO', ...full })], undefined, NOW).promoDiscount, 0);
});
t('Voucher: ngoài thời gian hiệu lực -> lỗi', () => {
  const rows = allocateFefo([{ productId: 'p-milk', quantity: 1 }], products, batches, NOW);
  assert.throws(() => priceRows(rows, [promo({ code: 'V', requiresCode: true, endDate: day(-1) })], 'V', NOW), /đã kết thúc/);
});
t('Tự động theo nhóm hàng: chỉ giảm dòng thuộc nhóm SUA_CHUA', () => {
  const rows = allocateFefo([{ productId: 'p-milk', quantity: 3 }, { productId: 'p-yog', quantity: 4 }], products, batches, NOW);
  // yogurt: 120k - 12k (giảm riêng) = 108k -> 10% = 10.800
  const r = priceRows(rows, [promo({ scope: 'category', applicableCategory: 'SUA_CHUA', discountType: 'percentage', value: 10, minOrderValue: 100000 })], undefined, NOW);
  assert.equal(r.promoDiscount, 10800);
  assert.equal(r.rows.filter((x) => x.productId === 'p-milk').every((x) => x.promoDiscount === 0), true);
});
t('Giảm % có trần maxDiscountAmount', () => {
  const rows = allocateFefo([{ productId: 'p-milk', quantity: 10 }], products, batches, NOW); // 380k
  const r = priceRows(rows, [promo({ discountType: 'percentage', value: 50, maxDiscountAmount: 30000 })], undefined, NOW);
  assert.equal(r.promoDiscount, 30000);
});
t('Giảm cố định không vượt quá giá trị hàng đủ điều kiện', () => {
  const rows = allocateFefo([{ productId: 'p-milk', quantity: 1 }], products, batches, NOW); // 38k
  const r = priceRows(rows, [promo({ value: 100000 })], undefined, NOW);
  assert.equal(r.promoDiscount, 38000);
  assert.equal(r.finalTotal, 0);
});
t('near_expiry: chỉ giảm lô còn <= N ngày', () => {
  const rows = allocateFefo([{ productId: 'p-milk', quantity: 5 }], products, batches, NOW); // OLD(3,10 ngày) + NEW(2,90 ngày)
  const r = priceRows(rows, [promo({ scope: 'near_expiry', nearExpiryDays: 30, discountType: 'percentage', value: 20 })], undefined, NOW);
  assert.equal(r.promoDiscount, Math.round(3 * 38000 * 0.2));
  assert.equal(r.rows.find((x) => x.batchCode === 'NEW')!.promoDiscount, 0);
});
t('Nhiều khuyến mãi chồng nhau: tổng phân bổ == tổng giảm, không âm', () => {
  const rows = allocateFefo([{ productId: 'p-milk', quantity: 5 }, { productId: 'p-yog', quantity: 1 }], products, batches, NOW);
  const r = priceRows(rows, [promo({ id: 'a', code: 'A', discountType: 'percentage', value: 33 }), promo({ id: 'b', code: 'B', value: 7777 })], undefined, NOW);
  assert.equal(r.rows.reduce((s, x) => s + x.promoDiscount, 0), r.promoDiscount);
  assert.equal(r.applied.length, 2);
  assert.ok(r.rows.every((x) => x.unitPrice * x.quantity - x.productDiscount - x.promoDiscount >= 0));
});

// ── Thanh toán ──
t('Tiền mặt dư -> có tiền thối, ghi nhận tiền mặt sau khi trừ thối', () => {
  const s = settlePayments(228000, [{ method: 'cash', amount: 500000 }]);
  assert.equal(s.changeAmount, 272000);
  assert.deepEqual(s.rows, [{ method: 'cash', amount: 228000 }]);
  assert.equal(s.paymentMethod, 'cash');
});
t('Thanh toán nhiều hình thức -> mixed', () => {
  const s = settlePayments(500000, [
    { method: 'transfer', amount: 300000, reference: 'FT123' },
    { method: 'cash', amount: 200000 },
  ]);
  assert.equal(s.paymentMethod, 'mixed');
  assert.equal(s.changeAmount, 0);
  assert.equal(s.rows.length, 2);
});
t('Chuyển khoản thiếu mã giao dịch -> lỗi', () => {
  assert.throws(() => settlePayments(100000, [{ method: 'transfer', amount: 100000 }]), /mã giao dịch/);
});
t('Thẻ thiếu mã chuẩn chi -> lỗi', () => {
  assert.throws(() => settlePayments(100000, [{ method: 'card', amount: 100000 }]), /chuẩn chi/);
});
t('Chuyển khoản + thẻ vượt tổng tiền -> lỗi', () => {
  assert.throws(() => settlePayments(100000, [{ method: 'transfer', amount: 150000, reference: 'a' }]), /không được vượt/);
});
t('Thanh toán chưa đủ -> lỗi', () => {
  assert.throws(() => settlePayments(100000, [{ method: 'cash', amount: 99999 }]), /chưa đủ/);
});
t('Hóa đơn 0đ -> không có khoản thanh toán, phương thức cash', () => {
  const s = settlePayments(0, [{ method: 'cash', amount: 0 }]);
  assert.deepEqual(s.rows, []);
  assert.equal(s.paymentMethod, 'cash');
});

console.log(`\n${n} test đạt`);
