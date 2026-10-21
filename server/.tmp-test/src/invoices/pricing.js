"use strict";
// Lõi tính giá hóa đơn: HÀM THUẦN (không đụng DB) để dùng chung cho xem trước và chốt hóa đơn,
// và để kiểm thử độc lập. Tiền tính bằng số nguyên đồng; giảm theo % làm tròn XUỐNG.
//
// QUY TẮC (cần quản lý review):
//  R1. Mỗi dòng hàng nhận tối đa 1 khuyến mãi cấp dòng (scope product | category | near_expiry): chọn cái giảm nhiều nhất.
//  R2. Cả hóa đơn nhận tối đa 1 khuyến mãi cấp đơn (scope order): chọn cái giảm nhiều nhất,
//      tính trên (tạm tính - tổng giảm cấp dòng).
//  R3. "Đơn tối thiểu" (minOrderValue) so với TẠM TÍNH trước mọi giảm giá.
//  R4. Khuyến mãi requiresCode chỉ tham gia khi thu ngân nhập đúng mã.
//  R5. fixed_amount chỉ có nghĩa ở cấp đơn; ở cấp dòng bị bỏ qua.
//  R6. "Giảm tối đa" (maxDiscountAmount) tính cho cả chương trình trên 1 hóa đơn;
//      nếu các dòng cộng lại vượt trần thì chia lại theo tỷ lệ.
//  R7. Hòa nhau về số tiền giảm: ưu tiên chương trình có mã nhập tay, sau đó theo mã chương trình A-Z.
Object.defineProperty(exports, "__esModule", { value: true });
exports.priceInvoice = priceInvoice;
const LINE_SCOPES = ['product', 'category', 'near_expiry'];
function matchesLine(p, l) {
    if (p.scope === 'product')
        return p.productIds.includes(l.productId);
    if (p.scope === 'category')
        return !!p.categoryCode && l.categoryCode === p.categoryCode;
    if (p.scope === 'near_expiry') {
        return p.nearExpiryDays != null && l.daysToExpiry >= 0 && l.daysToExpiry <= p.nearExpiryDays;
    }
    return false;
}
function priceInvoice(lines, promos, voucherCode) {
    const vc = voucherCode?.trim().toUpperCase() || null;
    const isVoucher = (p) => !!vc && p.code.toUpperCase() === vc;
    const lineSubtotals = lines.map((l) => l.quantity * l.unitPrice);
    const subtotal = lineSubtotals.reduce((a, b) => a + b, 0);
    // R3 + R4
    const eligible = promos
        .filter((p) => subtotal >= p.minOrderValue && (!p.requiresCode || isVoucher(p)))
        .sort((a, b) => a.code.localeCompare(b.code));
    // "Tốt hơn" theo R7
    const better = (d, p, cur) => !cur || d > cur.d || (d === cur.d && isVoucher(p) && !isVoucher(cur.p));
    // ---- R1: cấp dòng ----
    const lineWinners = lines.map((l, i) => {
        let best = null;
        for (const p of eligible) {
            if (!LINE_SCOPES.includes(p.scope) || p.discountType !== 'percentage')
                continue; // R5
            if (!matchesLine(p, l))
                continue;
            const d = Math.floor((lineSubtotals[i] * p.value) / 100);
            if (d > 0 && better(d, p, best))
                best = { d, p };
        }
        return best;
    });
    const lineDiscounts = lineWinners.map((w) => w?.d ?? 0);
    // ---- R6: trần giảm theo chương trình ----
    const byPromo = new Map();
    lineWinners.forEach((w, i) => {
        if (w)
            byPromo.set(w.p.id, [...(byPromo.get(w.p.id) ?? []), i]);
    });
    for (const [promoId, idxs] of byPromo) {
        const p = lineWinners[idxs[0]].p;
        if (p.maxDiscountAmount == null)
            continue;
        const total = idxs.reduce((s, i) => s + lineDiscounts[i], 0);
        if (total <= p.maxDiscountAmount)
            continue;
        let assigned = 0;
        for (const i of idxs) {
            lineDiscounts[i] = Math.floor((lineDiscounts[i] * p.maxDiscountAmount) / total);
            assigned += lineDiscounts[i];
        }
        let remainder = p.maxDiscountAmount - assigned; // chia nốt phần dư làm tròn, mỗi lần 1 đồng
        for (const i of idxs) {
            if (remainder <= 0)
                break;
            const room = Math.floor((lineSubtotals[i] * p.value) / 100) - lineDiscounts[i];
            if (room > 0) {
                lineDiscounts[i] += 1;
                remainder -= 1;
            }
        }
        void promoId;
    }
    const rows = [];
    lineWinners.forEach((w, i) => {
        if (w && lineDiscounts[i] > 0) {
            rows.push({
                promotionId: w.p.id, code: w.p.code, name: w.p.name,
                lineIndex: i, discountAmount: lineDiscounts[i],
            });
        }
    });
    // ---- R2: cấp đơn ----
    const lineTotalDiscount = lineDiscounts.reduce((a, b) => a + b, 0);
    const base = subtotal - lineTotalDiscount;
    let orderBest = null;
    for (const p of eligible) {
        if (p.scope !== 'order')
            continue;
        let d = p.discountType === 'percentage'
            ? Math.floor((base * p.value) / 100)
            : Math.floor(p.value);
        if (p.discountType === 'percentage' && p.maxDiscountAmount != null) {
            d = Math.min(d, p.maxDiscountAmount);
        }
        d = Math.min(d, base);
        if (d > 0 && better(d, p, orderBest))
            orderBest = { d, p };
    }
    const orderDiscount = orderBest?.d ?? 0;
    if (orderBest) {
        rows.push({
            promotionId: orderBest.p.id, code: orderBest.p.code, name: orderBest.p.name,
            lineIndex: null, discountAmount: orderDiscount,
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
