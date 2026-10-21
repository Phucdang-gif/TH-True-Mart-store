import { priceInvoice, PricingPromo, PricingLine } from '../src/invoices/pricing';
let fail=0; const eq=(n:string,a:any,b:any)=>{const ok=JSON.stringify(a)===JSON.stringify(b); if(!ok)fail++; console.log(ok?'OK  ':'FAIL',n, ok?'':`\n   got ${JSON.stringify(a)}\n   exp ${JSON.stringify(b)}`)};
const P=(o:Partial<PricingPromo>&{code:string}):PricingPromo=>({id:o.code,name:o.code,scope:'order',discountType:'percentage',value:0,maxDiscountAmount:null,minOrderValue:0,categoryCode:null,nearExpiryDays:null,productIds:[],requiresCode:false,...o});
const L=(o:Partial<PricingLine>):PricingLine=>({productId:'p1',categoryCode:'SUA_CHUA',quantity:1,unitPrice:10000,daysToExpiry:100,...o});
const TUANLE=P({code:'KM-TUAN-LE',value:5,maxDiscountAmount:20000,minOrderValue:100000});
const G20=P({code:'GIAM20K',discountType:'fixed_amount',value:20000,minOrderValue:150000,requiresCode:true});
const SC=P({code:'KM-SUACHUA',scope:'category',value:10,categoryCode:'SUA_CHUA'});
const XA=P({code:'XA-HANG-HSD',scope:'near_expiry',value:30,nearExpiryDays:10});

// 1. không KM
eq('không KM', priceInvoice([L({quantity:2})],[]).finalTotal, 20000);
// 2. đơn 200k: auto 5% = 10k
let r=priceInvoice([L({quantity:20})],[TUANLE,G20]); eq('auto 5% đơn 200k',[r.discountAmount,r.finalTotal],[10000,190000]);
// 3. có voucher 20k thắng auto 10k (R2: chỉ 1 KM cấp đơn)
r=priceInvoice([L({quantity:20})],[TUANLE,G20],'giam20k'); eq('voucher 20k thắng auto',[r.discountAmount,r.rows.map(x=>x.code)],[20000,['GIAM20K']]);
// 4. không nhập mã => voucher không tự áp
r=priceInvoice([L({quantity:20})],[G20]); eq('voucher không tự áp',r.discountAmount,0);
// 5. dưới đơn tối thiểu
r=priceInvoice([L({quantity:5})],[TUANLE]); eq('dưới min order',r.discountAmount,0);
// 6. cap 20k của KM-TUAN-LE: đơn 1 triệu => 5% = 50k, cap 20k
r=priceInvoice([L({quantity:100})],[TUANLE]); eq('cap cấp đơn',r.discountAmount,20000);
// 7. cấp dòng nhóm hàng 10%, và cấp đơn tính trên phần còn lại: 20 x 10k=200k; dòng giảm 20k; base 180k; 5%=9k
r=priceInvoice([L({quantity:20})],[SC,TUANLE]); eq('dòng + đơn',[r.lineDiscounts,r.orderDiscount,r.finalTotal],[[20000],9000,171000]);
// 8. cận date thắng nhóm hàng (30% > 10%) trên cùng dòng, chỉ 1 KM/dòng
r=priceInvoice([L({quantity:10,daysToExpiry:5})],[SC,XA]); eq('R1 best-of cận date',[r.lineDiscounts,r.rows.map(x=>x.code)],[[30000],['XA-HANG-HSD']]);
// 9. lô cùng sản phẩm tách 2 dòng: chỉ dòng cận date được giảm
r=priceInvoice([L({quantity:3,daysToExpiry:5}),L({quantity:3,daysToExpiry:50})],[XA]); eq('cận date theo từng lô',r.lineDiscounts,[9000,0]);
// 10. cận date: lô đã hết hạn (days<0) không được giảm
r=priceInvoice([L({quantity:1,daysToExpiry:-1})],[XA]); eq('days<0 không giảm',r.discountAmount,0);
// 11. trần theo chương trình chia tỷ lệ (2 dòng 100k, 10% => 10k+10k, cap 15k)
const CAP=P({code:'CAP',scope:'category',value:10,categoryCode:'SUA_CHUA',maxDiscountAmount:15000});
r=priceInvoice([L({quantity:10,unitPrice:10000}),L({quantity:10,unitPrice:10000})],[CAP]); eq('cap chia tỷ lệ',[r.lineDiscounts,r.discountAmount],[[7500,7500],15000]);
// 12. fixed_amount cấp dòng bị bỏ qua (R5)
r=priceInvoice([L({quantity:5})],[P({code:'FX',scope:'product',discountType:'fixed_amount',value:5000,productIds:['p1']})]); eq('R5 fixed cấp dòng bỏ qua',r.discountAmount,0);
// 13. giảm không vượt tạm tính: fixed 50k trên đơn 30k
r=priceInvoice([L({quantity:3})],[P({code:'BIG',discountType:'fixed_amount',value:50000,requiresCode:true})],'BIG'); eq('không vượt tạm tính',[r.discountAmount,r.finalTotal],[30000,0]);
// 14. làm tròn xuống: 5% của 33.333 = 1666
r=priceInvoice([L({quantity:1,unitPrice:33333})],[P({code:'T',value:5})]); eq('làm tròn xuống',r.discountAmount,1666);
// 15. hòa: ưu tiên voucher nhập tay
const A=P({code:'A-AUTO',value:10}); const B=P({code:'B-VOUCHER',value:10,requiresCode:true});
r=priceInvoice([L({quantity:10})],[A,B],'B-VOUCHER'); eq('R7 hòa ưu tiên mã nhập',r.rows.map(x=>x.code),['B-VOUCHER']);
console.log(fail?`\n${fail} FAIL`:'\nTẤT CẢ ĐẠT');
