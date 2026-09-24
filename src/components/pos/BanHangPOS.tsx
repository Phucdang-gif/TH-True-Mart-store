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
  UserCheck, 
  RotateCcw, 
  XCircle,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { Product, Batch, Customer, Promotion, Invoice, CartItem } from '../../types';

interface BanHangPOSProps {
  products: Product[];
  batches: Batch[];
  customers: Customer[];
  promotions: Promotion[];
  invoices: Invoice[];
  onCompleteSale: (invoice: Invoice) => void;
  onReturnInvoice: (invoiceId: string, reason: string) => void;
  onCancelInvoice: (invoiceId: string, reason: string) => void;
}

export const BanHangPOS: React.FC<BanHangPOSProps> = ({
  products,
  batches,
  customers,
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
  
  // Customer & Promotion state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [barcodeSuccessMsg, setBarcodeSuccessMsg] = useState<string | null>(null);

  // Return / Cancel modal state
  const [selectedInvoiceForAction, setSelectedInvoiceForAction] = useState<Invoice | null>(null);
  const [actionType, setActionType] = useState<'return' | 'cancel' | null>(null);
  const [actionReason, setActionReason] = useState('');

  // Categories list
  const categories = [
    'all',
    'Sữa tươi tiệt trùng',
    'Sữa tươi thanh trùng',
    'Sữa chua ăn & uống',
    'Bơ & Phô mai tự nhiên',
    'Kem TH true ICE CREAM',
    'Nước tinh khiết & Nước trái cây',
    'Trà tự nhiên TH true TEA'
  ];

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

  // Voucher discount
  let voucherDiscount = 0;
  if (appliedPromo) {
    if (appliedPromo.discountType === 'percentage') {
      voucherDiscount = (subtotal * appliedPromo.value) / 100;
    } else {
      voucherDiscount = appliedPromo.value;
    }
  }

  // Customer Points discount (1 point = 1.000đ)
  const maxUsablePoints = selectedCustomer ? Math.min(selectedCustomer.points, Math.floor((subtotal - itemDiscounts - voucherDiscount) / 1000)) : 0;
  const pointsDiscount = usePoints && selectedCustomer ? Math.max(0, maxUsablePoints * 1000) : 0;

  const totalDiscount = itemDiscounts + voucherDiscount + pointsDiscount;
  const finalTotal = Math.max(0, subtotal - totalDiscount);
  const changeAmount = Math.max(0, cashGiven - finalTotal);

  // Handle Apply Promo
  const handleApplyPromo = () => {
    const promo = promotions.find(p => p.code.toUpperCase() === promoCode.trim().toUpperCase() && p.status === 'active');
    if (!promo) {
      alert('Mã khuyến mãi không hợp lệ hoặc đã hết hạn!');
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
    if (paymentMethod === 'cash' && cashGiven < finalTotal) {
      alert('Số tiền khách đưa chưa đủ để thanh toán!');
      return;
    }

    const newInvoiceCode = `HD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(100 + Math.random() * 900)}`;
    const earnedPoints = Math.floor(finalTotal / 10000); // 10k = 1 point

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      code: newInvoiceCode,
      createdAt: new Date().toLocaleString('vi-VN'),
      cashierId: 'staff-01',
      cashierName: 'Đặng Hoàng Phúc (Admin)',
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      customerPhone: selectedCustomer?.phone,
      items: cart.map(item => ({
        productId: item.product.id,
        productCode: item.product.code,
        productName: item.product.name,
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
      pointsUsed: usePoints ? maxUsablePoints : 0,
      pointsEarned: earnedPoints,
      finalTotal,
      paymentMethod,
      receivedAmount: paymentMethod === 'cash' ? cashGiven : finalTotal,
      changeAmount: paymentMethod === 'cash' ? changeAmount : 0,
      status: 'completed',
      notes
    };

    onCompleteSale(newInvoice);

    // Reset cart
    setCart([]);
    setAppliedPromo(null);
    setPromoCode('');
    setSelectedCustomer(null);
    setUsePoints(false);
    setCashGiven(0);
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
                    {cat === 'all' ? 'Tất cả sản phẩm TH' : cat}
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

              {/* Customer TH Club Lookup (1.3 & 4.2) */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#004885]" />
                  <span>Khách hàng thành viên (TH Club)</span>
                </label>
                {selectedCustomer ? (
                  <div className="bg-sky-50 p-2.5 rounded-lg border border-sky-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-sky-950">
                        {selectedCustomer.name} - {selectedCustomer.phone}
                      </p>
                      <p className="text-[10px] text-sky-800">
                        Hạng: <span className="font-bold">{selectedCustomer.tier}</span> | Điểm khả dụng: <span className="font-bold text-emerald-700">{selectedCustomer.points}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setUsePoints(false);
                      }}
                      className="text-xs text-slate-400 hover:text-rose-600 font-bold"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Nhập số điện thoại khách hàng..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:bg-white"
                    />
                    <button
                      onClick={() => {
                        const found = customers.find(c => c.phone.includes(customerSearch.trim()) || c.name.toLowerCase().includes(customerSearch.toLowerCase()));
                        if (found) {
                          setSelectedCustomer(found);
                          setCustomerSearch('');
                        } else {
                          alert('Không tìm thấy khách hàng! Vui lòng kiểm tra lại số điện thoại.');
                        }
                      }}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs px-3 py-1.5 rounded-lg font-semibold"
                    >
                      Tìm
                    </button>
                  </div>
                )}

                {selectedCustomer && selectedCustomer.points > 0 && (
                  <div className="flex items-center justify-between bg-amber-50 px-3 py-1.5 rounded border border-amber-200 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={usePoints}
                        onChange={(e) => setUsePoints(e.target.checked)}
                        className="rounded text-[#004885]"
                      />
                      <span className="text-amber-900 font-medium">
                        Đổi {maxUsablePoints} điểm True Point (-{(maxUsablePoints * 1000).toLocaleString('vi-VN')} đ)
                      </span>
                    </label>
                  </div>
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
                      placeholder="Nhập mã THSUMMER10, THVIP20K..."
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

              {/* Payment Methods */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <label className="text-[11px] font-bold text-slate-700">Phương thức thanh toán</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-2 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === 'cash'
                        ? 'border-[#004885] bg-sky-50 text-[#004885]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Tiền mặt</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('transfer')}
                    className={`p-2 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === 'transfer'
                        ? 'border-[#004885] bg-sky-50 text-[#004885]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>VietQR</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`p-2 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === 'card'
                        ? 'border-[#004885] bg-sky-50 text-[#004885]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Thẻ POS</span>
                  </button>
                </div>

                {paymentMethod === 'cash' && (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Tiền khách đưa:</span>
                      <input
                        type="number"
                        value={cashGiven || ''}
                        onChange={(e) => setCashGiven(Number(e.target.value))}
                        placeholder="Nhập số tiền..."
                        className="w-32 px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold text-xs"
                      />
                    </div>
                    {/* Fast Denominations */}
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
                        onClick={() => setCashGiven(finalTotal)}
                        className="px-2 py-0.5 text-[10px] bg-sky-100 text-sky-800 rounded font-bold"
                      >
                        Đủ tiền
                      </button>
                    </div>
                    {cashGiven > 0 && (
                      <div className="flex justify-between text-xs font-semibold border-t border-slate-200 pt-1">
                        <span>Tiền thừa trả khách:</span>
                        <span className={cashGiven >= finalTotal ? 'text-emerald-700' : 'text-rose-600'}>
                          {changeAmount.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    )}
                  </div>
                )}
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
                disabled={cart.length === 0}
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
                  <th className="py-2.5 px-3">Khách hàng</th>
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
                    <td className="py-2.5 px-3 text-slate-700">
                      {inv.customerName ? `${inv.customerName} (${inv.customerPhone})` : 'Khách vãng lai'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{inv.items.length} mặt hàng</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {inv.finalTotal.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        inv.status === 'returned' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {inv.status === 'completed' ? 'Đã hoàn tất' : inv.status === 'returned' ? 'Đã đổi trả' : 'Đã hủy'}
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
                onClick={() => {
                  if (actionType === 'return') {
                    onReturnInvoice(selectedInvoiceForAction.id, actionReason || 'Khách đổi trả');
                  } else {
                    onCancelInvoice(selectedInvoiceForAction.id, actionReason || 'Hủy hóa đơn sai sót');
                  }
                  setSelectedInvoiceForAction(null);
                  setActionType(null);
                }}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg ${
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
