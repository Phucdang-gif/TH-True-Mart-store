import React, { useState } from 'react';
import { 
  Search, 
  Barcode, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Sparkles, 
  Tag, 
  RotateCcw, 
  XCircle,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { Product, Batch, Promotion, Invoice, InvoicePayment, InvoiceApproval, CartItem, Staff, PaymentMethod } from '../../types';
import { CATEGORY_LABELS, CATEGORY_LIST, INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../../lib/labels';

interface BanHangPOSProps {
  products: Product[];
  batches: Batch[];
  currentStaff: Staff; // nhân viên đang đăng nhập (thu ngân / quản lý)
  promotions: Promotion[];
  invoices: Invoice[];
  onCompleteSale: (invoice: Invoice) => void;
  onReturnInvoice: (invoiceId: string, approval: Omit<InvoiceApproval, 'id' | 'createdAt' | 'action'>) => void;
  onCancelInvoice: (invoiceId: string, approval: Omit<InvoiceApproval, 'id' | 'createdAt' | 'action'>) => void;
}

export const BanHangPOS: React.FC<BanHangPOSProps> = ({
  products,
  batches,
  currentStaff,
  promotions,
  invoices,
  onCompleteSale,
  onReturnInvoice,
  onCancelInvoice
}) => {
  const [subTab, setSubTab] = useState<'pos' | 'history'>('pos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  
  // Promotion state
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  
  // Payment state: thanh toán nhiều hình thức (bảng invoice_payments)
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferRef, setTransferRef] = useState('');
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [cardRef, setCardRef] = useState('');
  const [notes, setNotes] = useState('');
  const [barcodeSuccessMsg, setBarcodeSuccessMsg] = useState<string | null>(null);

  // Return / Cancel modal state
  const [selectedInvoiceForAction, setSelectedInvoiceForAction] = useState<Invoice | null>(null);
  const [actionType, setActionType] = useState<'return' | 'cancel' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash');
  const [refundRef, setRefundRef] = useState('');
  const isManager = currentStaff.role === 'manager'; // quyền invoice:approve

  // Categories list (mã enum của DB)
  const categories: string[] = ['all', ...CATEGORY_LIST];

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.barcode.includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  // Helper to find earliest expiry batch (FIFO)
  const getFIFOBatch = (productId: string): Batch | undefined => {
    return batches
      .filter(b => b.productId === productId && b.quantity > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0];
  };

  // Add to cart
  const addToCart = (product: Product) => {
    const availableBatch = getFIFOBatch(product.id);
    const existingIndex = cart.findIndex(item => item.product.id === product.id);

    if (existingIndex > 0 || existingIndex === 0) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      const unitPrice = product.sellingPrice;
      const discount = product.discountPercent ? (unitPrice * product.discountPercent) / 100 : 0;
      updated[existingIndex].total = (unitPrice - discount) * updated[existingIndex].quantity;
      setCart(updated);
    } else {
      const unitPrice = product.sellingPrice;
      const discount = product.discountPercent ? (unitPrice * product.discountPercent) / 100 : 0;
      setCart([
        ...cart,
        {
          product,
          selectedBatch: availableBatch,
          quantity: 1,
          unitPrice,
          discount,
          total: unitPrice - discount
        }
      ]);
    }
  };

  // Barcode scanner trigger
  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const found = products.find(p => p.barcode === barcodeInput.trim() || p.code.toLowerCase() === barcodeInput.trim().toLowerCase());
    if (found) {
      addToCart(found);
      setBarcodeSuccessMsg(`Đã thêm: ${found.name}`);
      setTimeout(() => setBarcodeSuccessMsg(null), 2500);
      setBarcodeInput('');
    } else {
      alert(`Không tìm thấy sản phẩm có mã barcode: ${barcodeInput}`);
    }
  };

  // Change quantity
  const updateQuantity = (index: number, delta: number) => {
    const updated = [...cart];
    const newQty = updated[index].quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].quantity = newQty;
      const unitPrice = updated[index].product.sellingPrice;
      const discount = updated[index].discount;
      updated[index].total = (unitPrice - discount) * newQty;
    }
    setCart(updated);
  };

  // Calculate totals
  const subtotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  const itemDiscounts = cart.reduce((acc, item) => acc + (item.discount * item.quantity), 0);

  // Voucher discount (theo promotions.discountType, có trần maxDiscountAmount khi giảm %)
  let voucherDiscount = 0;
  if (appliedPromo) {
    if (appliedPromo.discountType === 'percentage') {
      voucherDiscount = (subtotal * appliedPromo.value) / 100;
      if (appliedPromo.maxDiscountAmount) {
        voucherDiscount = Math.min(voucherDiscount, appliedPromo.maxDiscountAmount);
      }
    } else {
      voucherDiscount = appliedPromo.value;
    }
  }

  const totalDiscount = itemDiscounts + voucherDiscount;
  const finalTotal = Math.max(0, subtotal - totalDiscount);

  // Tổng hợp các khoản thanh toán: chuyển khoản/thẻ không được vượt phần còn lại, tiền mặt được đưa dư để thối
  const nonCashPaid = transferAmount + cardAmount;
  const cashDue = Math.max(0, finalTotal - nonCashPaid); // phần phải trả bằng tiền mặt
  const totalReceived = cashGiven + nonCashPaid;
  const changeAmount = Math.max(0, totalReceived - finalTotal);
  const isPaidEnough = totalReceived >= finalTotal && nonCashPaid <= finalTotal;

  // Handle Apply Promo
  const handleApplyPromo = () => {
    const promo = promotions.find(p => p.code.toUpperCase() === promoCode.trim().toUpperCase() && p.status === 'active');
    if (!promo) {
      alert('Mã khuyến mãi không hợp lệ hoặc chương trình không còn hoạt động!');
      return;
    }
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
      alert('Mã khuyến mãi đã hết lượt sử dụng!');
      return;
    }
    if (subtotal < promo.minOrderValue) {
      alert(`Đơn hàng phải từ ${promo.minOrderValue.toLocaleString('vi-VN')} đ để áp dụng mã này!`);
      return;
    }
    setAppliedPromo(promo);
  };

  // Handle Checkout
  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Giỏ hàng trống! Vui lòng chọn sản phẩm.');
      return;
    }
    if (nonCashPaid > finalTotal) {
      alert('Tổng chuyển khoản + thẻ không được vượt quá số tiền phải trả!');
      return;
    }
    if (!isPaidEnough) {
      alert('Số tiền thanh toán chưa đủ! Hóa đơn chỉ hoàn tất khi tổng các khoản đã nhận >= số tiền phải trả.');
      return;
    }
    if ((transferAmount > 0 && !transferRef.trim())) {
      alert('Vui lòng nhập mã giao dịch chuyển khoản để xác nhận đã nhận tiền!');
      return;
    }
    if ((cardAmount > 0 && !cardRef.trim())) {
      alert('Vui lòng nhập mã chuẩn chi thẻ!');
      return;
    }

    const nowStr = new Date().toLocaleString('vi-VN');
    const stamp = Date.now();
    const newInvoiceCode = `HD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(100 + Math.random() * 900)}`;

    // Tách từng khoản thanh toán; tiền mặt ghi nhận sau khi trừ tiền thối
    const cashApplied = Math.min(cashGiven, cashDue);
    const payments: InvoicePayment[] = [];
    if (cashApplied > 0) {
      payments.push({ id: `pay-${stamp}-c`, method: 'cash', amount: cashApplied, status: 'confirmed', confirmedById: currentStaff.id, confirmedAt: nowStr });
    }
    if (transferAmount > 0) {
      payments.push({ id: `pay-${stamp}-t`, method: 'transfer', amount: transferAmount, status: 'confirmed', reference: transferRef.trim(), confirmedById: currentStaff.id, confirmedAt: nowStr });
    }
    if (cardAmount > 0) {
      payments.push({ id: `pay-${stamp}-k`, method: 'card', amount: cardAmount, status: 'confirmed', reference: cardRef.trim(), confirmedById: currentStaff.id, confirmedAt: nowStr });
    }
    const paymentMethod: PaymentMethod = payments.length > 1 ? 'mixed' : payments[0]?.method ?? 'cash';

    const newInvoice: Invoice = {
      id: `inv-${stamp}`,
      code: newInvoiceCode,
      createdAt: nowStr,
      cashierId: currentStaff.id,
      cashierName: currentStaff.name,
      items: cart.map(item => ({
        productId: item.product.id,
        productCode: item.product.code,
        productName: item.product.name,
        batchId: item.selectedBatch?.id,
        batchCode: item.selectedBatch?.batchCode || 'LOTH-DEFAULT',
        unit: item.product.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        subtotal: item.total
      })),
      subtotal,
      discountAmount: totalDiscount,
      voucherCode: appliedPromo?.code,
      finalTotal,
      paymentMethod,
      payments,
      receivedAmount: totalReceived,
      changeAmount,
      paidAt: nowStr,
      status: 'completed',
      notes
    };

    onCompleteSale(newInvoice);

    // Reset cart
    setCart([]);
    setAppliedPromo(null);
    setPromoCode('');
    setCashGiven(0);
    setTransferAmount(0);
    setTransferRef('');
    setCardAmount(0);
    setCardRef('');
    setNotes('');
  };

  return (
    <div className="space-y-4">
      {/* Sub navigation between POS & Invoice History (1.4 Return / Cancel) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            id="subtab-pos"
            onClick={() => setSubTab('pos')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'pos'
                ? 'bg-[#004885] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            1.1 - 1.3 Màn hình thu ngân POS
          </button>
          <button
            id="subtab-history"
            onClick={() => setSubTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === 'history'
                ? 'bg-[#004885] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            1.4 Đổi trả & Hủy hóa đơn ({invoices.length})
          </button>
        </div>

        {subTab === 'pos' && barcodeSuccessMsg && (
          <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-bounce">
            <span>✓ {barcodeSuccessMsg}</span>
          </div>
        )}
      </div>

      {subTab === 'pos' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT 7 COLS: Product Catalog & Search (1.1) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search & Barcode Quick Input */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Search Text */}
                <div className="sm:col-span-7 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    id="input-search-product"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên sữa, mã TH-MILK, barcode..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all outline-hidden"
                  />
                </div>

                {/* Simulated Barcode Scanner (Chức năng quét mã) */}
                <form onSubmit={handleBarcodeScan} className="sm:col-span-5 flex gap-1.5">
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 text-slate-500 absolute left-2.5 top-3" />
                    <input
                      id="input-barcode-scanner"
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="Quét mã vạch..."
                      className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all outline-hidden font-mono"
                    />
                  </div>
                  <button
                    id="btn-scan-barcode"
                    type="submit"
                    className="bg-[#004885] hover:bg-[#00386b] text-white text-xs px-3 py-2 rounded-lg font-semibold transition-colors shrink-0"
                  >
                    Quét
                  </button>
                </form>
              </div>

              {/* Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'all' ? 'Tất cả sản phẩm TH' : CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[540px] overflow-y-auto pr-1">
              {filteredProducts.map(product => {
                const availableBatch = getFIFOBatch(product.id);
                const isExpiringSoon = availableBatch?.status === 'expiring_soon';

                return (
                  <div
                    key={product.id}
                    id={`product-card-${product.id}`}
                    onClick={() => addToCart(product)}
                    className="bg-white border border-slate-200 hover:border-sky-500 hover:shadow-md rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition-all group relative overflow-hidden"
                  >
                    {product.discountPercent && (
                      <span className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        -{product.discountPercent}%
                      </span>
                    )}

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-[#004885] bg-sky-50 px-2 py-0.5 rounded inline-block">
                        {product.code}
                      </span>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-[#004885] transition-colors">
                        {product.name}
                      </h4>
                      <p className="text-[11px] text-slate-500">ĐVT: {product.unit}</p>

                      {/* Batch & Expiry Tag (Lô & Date) */}
                      {availableBatch ? (
                        <div className={`text-[10px] px-2 py-1 rounded flex items-center justify-between ${
                          isExpiringSoon ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-50 text-slate-600'
                        }`}>
                          <span className="truncate">Lô: {availableBatch.batchCode}</span>
                          <span className="font-semibold">{availableBatch.expiryDate.slice(5)}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                          Hết hàng trong kho
                        </div>
                      )}
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-extrabold text-[#004885]">
                          {product.sellingPrice.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                      <button
                        className="w-7 h-7 rounded-lg bg-sky-50 group-hover:bg-[#004885] text-[#004885] group-hover:text-white flex items-center justify-center transition-colors"
                        title="Thêm vào giỏ"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT 5 COLS: Cart & Checkout (1.2 & 1.3) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span>Giỏ hàng bán lẻ</span>
                  <span className="bg-sky-100 text-[#004885] text-xs px-2 py-0.5 rounded-full font-bold">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                </h3>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                  >
                    Xóa tất cả
                  </button>
                )}
              </div>

              {/* Cart List */}
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 space-y-1">
                    <p className="text-xs">Chưa có sản phẩm nào trong đơn.</p>
                    <p className="text-[11px]">Bấm vào sản phẩm bên trái hoặc quét mã vạch để thêm.</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{item.product.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {item.product.unit} | Lô: {item.selectedBatch?.batchCode || 'N/A'} (HSD: {item.selectedBatch?.expiryDate || 'N/A'})
                        </p>
                        <span className="text-xs font-bold text-[#004885]">
                          {(item.unitPrice - item.discount).toLocaleString('vi-VN')} đ
                        </span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md p-0.5">
                        <button
                          onClick={() => updateQuantity(idx, -1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold px-1.5 min-w-[20px] text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(idx, 1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          const c = [...cart];
                          c.splice(idx, 1);
                          setCart(c);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Promotion Voucher (1.3) */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-rose-500" />
                  <span>Mã khuyến mãi / Voucher</span>
                </label>
                {appliedPromo ? (
                  <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                    <span className="font-bold">✓ {appliedPromo.code}: {appliedPromo.name}</span>
                    <button
                      onClick={() => setAppliedPromo(null)}
                      className="text-rose-600 font-bold hover:underline"
                    >
                      Hủy mã
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Nhập mã voucher (VD: THVIP20K)..."
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:bg-white font-mono uppercase"
                    />
                    <button
                      onClick={handleApplyPromo}
                      className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
                    >
                      Áp dụng
                    </button>
                  </div>
                )}
              </div>

              {/* Thanh toán nhiều hình thức (tiền mặt + chuyển khoản + thẻ) */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <label className="text-[11px] font-bold text-slate-700">Thanh toán (có thể kết hợp nhiều hình thức)</label>

                {/* Chuyển khoản */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 flex items-center gap-1.5"><QrCode className="w-4 h-4" /> Chuyển khoản (VietQR):</span>
                    <input
                      type="number"
                      value={transferAmount || ''}
                      onChange={(e) => setTransferAmount(Math.max(0, Number(e.target.value)))}
                      placeholder="Số tiền..."
                      className="w-32 px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold text-xs"
                    />
                  </div>
                  {transferAmount > 0 && (
                    <input
                      type="text"
                      value={transferRef}
                      onChange={(e) => setTransferRef(e.target.value)}
                      placeholder="Mã giao dịch chuyển khoản (đã nhận tiền)..."
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                </div>

                {/* Thẻ */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> Thẻ POS:</span>
                    <input
                      type="number"
                      value={cardAmount || ''}
                      onChange={(e) => setCardAmount(Math.max(0, Number(e.target.value)))}
                      placeholder="Số tiền..."
                      className="w-32 px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold text-xs"
                    />
                  </div>
                  {cardAmount > 0 && (
                    <input
                      type="text"
                      value={cardRef}
                      onChange={(e) => setCardRef(e.target.value)}
                      placeholder="Mã chuẩn chi thẻ..."
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  )}
                </div>

                {/* Tiền mặt */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 flex items-center gap-1.5"><Banknote className="w-4 h-4" /> Tiền mặt khách đưa:</span>
                    <input
                      type="number"
                      value={cashGiven || ''}
                      onChange={(e) => setCashGiven(Math.max(0, Number(e.target.value)))}
                      placeholder="Nhập số tiền..."
                      className="w-32 px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold text-xs"
                    />
                  </div>
                  <div className="flex gap-1 justify-end">
                    {[100000, 200000, 500000].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setCashGiven(amt)}
                        className="px-2 py-0.5 text-[10px] bg-white border border-slate-300 rounded hover:bg-slate-100 font-medium"
                      >
                        {(amt / 1000)}k
                      </button>
                    ))}
                    <button
                      onClick={() => setCashGiven(cashDue)}
                      className="px-2 py-0.5 text-[10px] bg-sky-100 text-sky-800 rounded font-bold"
                    >
                      Đủ tiền
                    </button>
                  </div>
                </div>

                <div className="flex justify-between text-xs font-semibold border-t border-slate-200 pt-1">
                  <span>{isPaidEnough ? 'Tiền thừa trả khách:' : 'Còn thiếu:'}</span>
                  <span className={isPaidEnough ? 'text-emerald-700' : 'text-rose-600'}>
                    {(isPaidEnough ? changeAmount : Math.max(0, finalTotal - totalReceived)).toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              {/* Order Summary Breakdown */}
              <div className="bg-slate-50 p-3 rounded-lg space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Tổng tiền hàng:</span>
                  <span>{subtotal.toLocaleString('vi-VN')} đ</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>Tổng giảm giá:</span>
                    <span>-{totalDiscount.toLocaleString('vi-VN')} đ</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-[#004885] pt-1.5 border-t border-slate-200">
                  <span>KHÁCH PHẢI TRẢ:</span>
                  <span>{finalTotal.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              {/* Complete Sale Button */}
              <button
                id="btn-checkout-sale"
                onClick={handleCheckout}
                disabled={cart.length === 0 || !isPaidEnough}
                className="w-full py-3 rounded-xl bg-[#004885] hover:bg-[#00386b] disabled:bg-slate-300 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                <span>Hoàn tất & In hóa đơn</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono">F9</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* SUBTAB 1.4: Đổi trả, hủy hóa đơn (Invoice History & Returns) */
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Danh sách hóa đơn bán hàng</h3>
              <p className="text-xs text-slate-500">Tra cứu hóa đơn, thực hiện nghiệp vụ đổi trả hàng hoặc hủy hóa đơn sai sót</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-2.5 px-3">Mã HĐ</th>
                  <th className="py-2.5 px-3">Thời gian</th>
                  <th className="py-2.5 px-3">Thu ngân</th>
                  <th className="py-2.5 px-3">Thanh toán</th>
                  <th className="py-2.5 px-3">Số món</th>
                  <th className="py-2.5 px-3 text-right">Tổng thanh toán</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[#004885]">{inv.code}</td>
                    <td className="py-2.5 px-3 text-slate-600">{inv.createdAt}</td>
                    <td className="py-2.5 px-3 text-slate-800">{inv.cashierName}</td>
                    <td className="py-2.5 px-3 text-slate-700">{PAYMENT_METHOD_LABELS[inv.paymentMethod]}</td>
                    <td className="py-2.5 px-3 text-slate-600">{inv.items.length} mặt hàng</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {inv.finalTotal.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        inv.status === 'returned' ? 'bg-amber-100 text-amber-800' :
                        inv.status === 'pending_payment' || inv.status === 'pending_approval' ? 'bg-sky-100 text-sky-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                      {inv.status === 'completed' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedInvoiceForAction(inv);
                              setActionType('return');
                              setActionReason('');
                            }}
                            className="px-2 py-1 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold text-[11px] inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Đổi trả</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedInvoiceForAction(inv);
                              setActionType('cancel');
                              setActionReason('');
                            }}
                            className="px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold text-[11px] inline-flex items-center gap-1"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Hủy HĐ</span>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Return / Cancel Dialog */}
      {selectedInvoiceForAction && actionType && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>
                {actionType === 'return' ? 'Xử lý đổi trả hàng (Hóa đơn ' : 'Xác nhận hủy hóa đơn ('}
                {selectedInvoiceForAction.code})
              </span>
            </div>

            <p className="text-xs text-slate-600">
              {actionType === 'return'
                ? 'Sản phẩm đổi trả sẽ được hoàn lại vào kho hàng. Vui lòng ghi rõ lý do (VD: Khách đổi sang sữa ít đường, vỏ hộp móp méo...):'
                : 'Hóa đơn sẽ chuyển sang trạng thái ĐÃ HỦY và hoàn lại số lượng tồn kho của các mặt hàng. Thao tác này không thể hoàn tác.'}
            </p>

            <textarea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Nhập lý do đổi trả hoặc hủy hóa đơn..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:bg-white focus:ring-2 focus:ring-sky-500"
            />

            {/* Hoàn tiền cho khách (invoice_approvals.refundAmount / refundMethod / refundRef) */}
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Số tiền hoàn lại:</span>
                <span className="font-bold text-slate-900">{selectedInvoiceForAction.finalTotal.toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Hoàn bằng:</span>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as PaymentMethod)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                >
                  <option value="cash">{PAYMENT_METHOD_LABELS.cash}</option>
                  <option value="transfer">{PAYMENT_METHOD_LABELS.transfer}</option>
                  <option value="card">{PAYMENT_METHOD_LABELS.card}</option>
                </select>
              </div>
              {refundMethod === 'transfer' && (
                <input
                  type="text"
                  value={refundRef}
                  onChange={(e) => setRefundRef(e.target.value)}
                  placeholder="Mã giao dịch hoàn tiền..."
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                />
              )}
              {!isManager && (
                <p className="text-[11px] text-amber-700">
                  Bạn không có quyền duyệt. Thao tác cần Quản lý xác nhận (invoice:approve) trước khi hoàn tiền.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setSelectedInvoiceForAction(null);
                  setActionType(null);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Hủy bỏ
              </button>
              <button
                disabled={!isManager}
                onClick={() => {
                  const approval = {
                    reason: actionReason || (actionType === 'return' ? 'Khách đổi trả' : 'Hủy hóa đơn sai sót'),
                    refundAmount: selectedInvoiceForAction.finalTotal,
                    refundMethod,
                    refundRef: refundMethod === 'transfer' ? refundRef.trim() || undefined : undefined,
                    approvedById: currentStaff.id
                  };
                  if (actionType === 'return') {
                    onReturnInvoice(selectedInvoiceForAction.id, approval);
                  } else {
                    onCancelInvoice(selectedInvoiceForAction.id, approval);
                  }
                  setSelectedInvoiceForAction(null);
                  setActionType(null);
                  setRefundMethod('cash');
                  setRefundRef('');
                }}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed ${
                  actionType === 'return' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionType === 'return' ? 'Xác nhận đổi trả' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
