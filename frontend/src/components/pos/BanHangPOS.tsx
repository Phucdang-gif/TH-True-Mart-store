import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Banknote,
  QrCode,
  Tag,
  Eye,
  CreditCard,
} from "lucide-react";
import { Product, Batch, Invoice, InvoicePreview } from "../../types";
import type { CreateInvoiceInput, PreviewInvoiceInput } from "../../types/api";
import {
  CATEGORY_LABELS,
  CATEGORY_LIST,
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from "../../lib/labels";
import { InvoiceModal } from "../InvoiceModal";

interface BanHangPOSProps {
  products: Product[];
  batches: Batch[];
  invoices: Invoice[];
  // Server tính giá + khuyến mãi + chọn lô FIFO (không ghi dữ liệu)
  onPreviewInvoice: (input: PreviewInvoiceInput) => Promise<InvoicePreview>;
  // Chốt hóa đơn: thanh toán + trừ kho. Ném lỗi nếu server từ chối.
  onCreateInvoice: (input: CreateInvoiceInput) => Promise<Invoice>;
}

// Giỏ hàng chỉ giữ sản phẩm + số lượng; giá, lô và khuyến mãi do server quyết định
interface CartLine {
  product: Product;
  quantity: number;
}

export const BanHangPOS: React.FC<BanHangPOSProps> = ({
  products,
  batches,
  invoices,
  onPreviewInvoice,
  onCreateInvoice,
}) => {
  const [subTab, setSubTab] = useState<"pos" | "history">("pos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [qtyNotice, setQtyNotice] = useState<string | null>(null);

  // Mã giảm giá thu ngân nhập tay (khuyến mãi requiresCode)
  const [promoCode, setPromoCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<string | null>(null);
  const [voucherNotice, setVoucherNotice] = useState<string | null>(null);

  // Kết quả server tính cho giỏ hiện tại
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Payment state: thanh toán nhiều hình thức (bảng invoice_payments)
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferRef, setTransferRef] = useState("");
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [cardRef, setCardRef] = useState("");
  const [notes, setNotes] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);

  // Hóa đơn đang xem / in (sau khi thanh toán hoặc bấm "Xem" ở lịch sử)
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);

  // Categories list (mã enum của DB)
  const categories: string[] = ["all", ...CATEGORY_LIST];

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesCat =
      selectedCategory === "all" || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Lô còn bán được: còn hàng và chưa hết hạn, hết hạn sớm nhất xếp trước (khớp quy tắc FIFO của server)
  const sellableBatches = (productId: string): Batch[] => {
    const now = new Date();
    return batches
      .filter(
        (b) =>
          b.productId === productId &&
          b.quantity > 0 &&
          new Date(b.expiryDate) >= now,
      )
      .sort(
        (a, b) =>
          new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
      );
  };
  const getFIFOBatch = (productId: string): Batch | undefined =>
    sellableBatches(productId)[0];
  const availableQty = (productId: string): number =>
    sellableBatches(productId).reduce((s, b) => s + b.quantity, 0);

  const toItems = () =>
    cart.map((i) => ({ productId: i.product.id, quantity: i.quantity }));

  // Add to cart
  const addToCart = (product: Product) => {
    const inCart = cart.find((i) => i.product.id === product.id)?.quantity ?? 0;
    const available = availableQty(product.id);
    if (inCart + 1 > available) {
      alert(`Sản phẩm "${product.name}" chỉ còn ${available} trong kho.`);
      return;
    }
    setCart((prev) =>
      prev.some((i) => i.product.id === product.id)
        ? prev.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          )
        : [...prev, { product, quantity: 1 }],
    );
  };

  // Change quantity
  const updateQuantity = (index: number, delta: number) => {
    const line = cart[index];
    clearQtyDraft(line.product.id);
    setQtyNotice(null);
    const newQty = line.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter((_, i) => i !== index));
      return;
    }
    const available = availableQty(line.product.id);
    if (newQty > available) {
      alert(`Sản phẩm "${line.product.name}" chỉ còn ${available} trong kho.`);
      return;
    }
    setCart(cart.map((l, i) => (i === index ? { ...l, quantity: newQty } : l)));
  };
  const clearQtyDraft = (productId: string) =>
    setQtyDraft((d) => {
      const { [productId]: _removed, ...rest } = d;
      return rest;
    });

  // Gõ số lượng từ bàn phím: chỉ nhận chữ số, vượt tồn thì tự đưa về số tối đa còn bán được
  const setQuantity = (index: number, raw: string) => {
    const line = cart[index];
    const key = line.product.id;
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    setQtyDraft((d) => ({ ...d, [key]: digits }));
    if (digits === "") return; // đang xóa để gõ số mới: chưa đổi giỏ hàng
    const n = parseInt(digits, 10);
    if (n < 1) return; // số 0 chưa hợp lệ: chờ gõ tiếp hoặc về số cũ khi rời ô
    const available = availableQty(key);
    if (available < 1) {
      setQtyNotice(`Sản phẩm "${line.product.name}" đã hết hàng trong kho.`);
      return;
    }
    if (n > available) {
      setQtyDraft((d) => ({ ...d, [key]: String(available) }));
      setQtyNotice(
        `Sản phẩm "${line.product.name}" chỉ còn ${available} trong kho.`,
      );
      setCart(
        cart.map((l, i) => (i === index ? { ...l, quantity: available } : l)),
      );
      return;
    }
    setQtyNotice(null);
    setCart(cart.map((l, i) => (i === index ? { ...l, quantity: n } : l)));
  };

  // Mỗi khi giỏ hoặc mã đổi: hỏi server tính lại (giá, lô FIFO, khuyến mãi tự động, mã giảm giá)
  useEffect(() => {
    if (cart.length === 0) {
      setPreview(null);
      setPreviewError(null);
      setPreviewing(false);
      return;
    }
    let cancelled = false;
    setPreviewing(true);
    const timer = setTimeout(async () => {
      try {
        const res = await onPreviewInvoice({
          items: toItems(),
          voucherCode: appliedVoucher ?? undefined,
        });
        if (cancelled) return;
        setPreview(res);
        setPreviewError(null);
        setPreviewing(false);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Không tính được giá";
        if (appliedVoucher) {
          // Mã không còn dùng được với giỏ hiện tại: gỡ mã rồi tính lại
          setVoucherNotice(`Đã gỡ mã ${appliedVoucher}: ${msg}`);
          setAppliedVoucher(null);
        } else {
          setPreview(null);
          setPreviewError(msg);
          setPreviewing(false);
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, appliedVoucher]);

  // Tổng tiền lấy từ server, giao diện không tự tính khuyến mãi
  const subtotal = preview?.subtotal ?? 0;
  const totalDiscount = preview?.discountAmount ?? 0;
  const finalTotal = preview?.finalTotal ?? 0;

  // Tổng hợp các khoản thanh toán: chuyển khoản/thẻ không được vượt phần còn lại, tiền mặt được đưa dư để thối
  const nonCashPaid = transferAmount + cardAmount;
  const cashDue = Math.max(0, finalTotal - nonCashPaid); // phần phải trả bằng tiền mặt
  const totalReceived = cashGiven + nonCashPaid;
  const changeAmount = Math.max(0, totalReceived - finalTotal);
  const isPaidEnough = totalReceived >= finalTotal && nonCashPaid <= finalTotal;
  const canCheckout =
    cart.length > 0 &&
    !!preview &&
    !previewing &&
    !previewError &&
    isPaidEnough &&
    !checkingOut;

  // Nhập mã giảm giá: server kiểm tra hạn dùng, lượt dùng, đơn tối thiểu (UC04)
  const handleApplyVoucher = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    if (cart.length === 0) {
      alert("Vui lòng thêm sản phẩm trước khi nhập mã giảm giá.");
      return;
    }
    try {
      await onPreviewInvoice({ items: toItems(), voucherCode: code });
      setAppliedVoucher(code);
      setVoucherNotice(null);
      setPromoCode("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Mã giảm giá không hợp lệ");
    }
  };

  // Handle Checkout
  const handleCheckout = async () => {
    if (!canCheckout) return;
    if (transferAmount > 0 && !transferRef.trim()) {
      alert(
        "Vui lòng nhập mã giao dịch chuyển khoản để xác nhận đã nhận tiền!",
      );
      return;
    }
    if (cardAmount > 0 && !cardRef.trim()) {
      alert("Vui lòng nhập mã chuẩn chi thẻ!");
      return;
    }

    // Tiền mặt gửi lên là SỐ KHÁCH ĐƯA; server tự tính tiền thừa
    const payments: CreateInvoiceInput["payments"] = [];
    if (transferAmount > 0) {
      payments.push({
        method: "transfer",
        amount: Math.round(transferAmount),
        reference: transferRef.trim(),
      });
    }
    if (cardAmount > 0) {
      payments.push({
        method: "card",
        amount: Math.round(cardAmount),
        reference: cardRef.trim(),
      });
    }
    if (cashDue > 0) {
      payments.push({ method: "cash", amount: Math.round(cashGiven) });
    }

    setCheckingOut(true);
    try {
      const invoice = await onCreateInvoice({
        items: toItems(),
        voucherCode: appliedVoucher ?? undefined,
        payments,
        notes: notes.trim() || undefined,
      });
      setPrintInvoice(invoice); // mở hóa đơn để in

      setCart([]);
      setAppliedVoucher(null);
      setVoucherNotice(null);
      setPromoCode("");
      setCashGiven(0);
      setTransferAmount(0);
      setTransferRef("");
      setCardAmount(0);
      setCardRef("");
      setNotes("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thể hoàn tất hóa đơn");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub navigation between POS & Invoice History */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            id="subtab-pos"
            onClick={() => setSubTab("pos")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === "pos"
                ? "bg-[#004885] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            1.1 - 1.3 Màn hình thu ngân POS
          </button>
          <button
            id="subtab-history"
            onClick={() => setSubTab("history")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === "history"
                ? "bg-[#004885] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Lịch sử hóa đơn ({invoices.length})
          </button>
        </div>
      </div>

      {subTab === "pos" ? (
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
                    placeholder="Tìm theo tên sữa, mã TH-MILK..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all outline-hidden"
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? "bg-sky-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat === "all"
                      ? "Tất cả sản phẩm TH"
                      : CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[540px] overflow-y-auto pr-1">
              {filteredProducts.map((product) => {
                const availableBatch = getFIFOBatch(product.id);
                const isExpiringSoon =
                  availableBatch?.status === "expiring_soon";

                return (
                  <div
                    key={product.id}
                    id={`product-card-${product.id}`}
                    onClick={() => addToCart(product)}
                    className="bg-white border border-slate-200 hover:border-sky-500 hover:shadow-md rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition-all group relative overflow-hidden"
                  >
                    {/* Vùng 2: đã xóa huy hiệu discountPercent */}

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-[#004885] bg-sky-50 px-2 py-0.5 rounded inline-block">
                        {product.code}
                      </span>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-[#004885] transition-colors">
                        {product.name}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        ĐVT: {product.unit}
                      </p>

                      {/* Batch & Expiry Tag (Lô & Date) */}
                      {availableBatch ? (
                        <div
                          className={`text-[10px] px-2 py-1 rounded flex items-center justify-between ${
                            isExpiringSoon
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-slate-50 text-slate-600"
                          }`}
                        >
                          <span className="truncate">
                            Lô: {availableBatch.batchCode}
                          </span>
                          <span className="font-semibold">
                            {availableBatch.expiryDate.slice(5)}
                          </span>
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
                          {product.sellingPrice.toLocaleString("vi-VN")} đ
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

              {/* Vùng 3: Cart List – giá và giảm giá lấy từ kết quả server tính */}
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 space-y-1">
                    <p className="text-xs">Chưa có sản phẩm nào trong đơn.</p>
                    <p className="text-[11px]">
                      Bấm vào sản phẩm bên trái để thêm.
                    </p>
                  </div>
                ) : (
                  cart.map((item, idx) => {
                    const lines =
                      preview?.lines.filter(
                        (l) => l.productId === item.product.id,
                      ) ?? [];
                    const gross = item.product.sellingPrice * item.quantity;
                    const lineDiscount = lines.reduce(
                      (s, l) => s + l.discount,
                      0,
                    );
                    const lineTotal = preview
                      ? lines.reduce((s, l) => s + l.subtotal, 0)
                      : gross;
                    return (
                      <div
                        key={item.product.id}
                        className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 flex items-center justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {item.product.name}
                          </p>
                          <span className="text-xs font-bold text-[#004885]">
                            {lineTotal.toLocaleString("vi-VN")} đ
                          </span>
                          {lineDiscount > 0 && (
                            <span className="ml-1.5 text-[10px] text-rose-600">
                              (giảm {lineDiscount.toLocaleString("vi-VN")} đ)
                            </span>
                          )}
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md p-0.5">
                          <button
                            onClick={() => updateQuantity(idx, -1)}
                            className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={
                              qtyDraft[item.product.id] ?? String(item.quantity)
                            }
                            onChange={(e) => setQuantity(idx, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => clearQtyDraft(item.product.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                            }}
                            aria-label={`Số lượng ${item.product.name}`}
                            className="w-10 text-xs font-bold text-center bg-transparent rounded outline-hidden focus:bg-sky-50"
                          />
                          <button
                            onClick={() => updateQuantity(idx, 1)}
                            className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          onClick={() =>
                            setCart(cart.filter((_, i) => i !== idx))
                          }
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {previewError && (
                <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                  {previewError}
                </p>
              )}
              {qtyNotice && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  {qtyNotice}
                </p>
              )}

              {/* Vùng 4: Mã giảm giá (UC04). Khuyến mãi không cần mã được server tự áp dụng. */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-rose-500" />
                  <span>Mã giảm giá</span>
                </label>
                {appliedVoucher ? (
                  <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                    <span className="font-bold">
                      ✓ Đã áp dụng mã {appliedVoucher}
                    </span>
                    <button
                      onClick={() => setAppliedVoucher(null)}
                      className="text-rose-600 font-bold hover:underline"
                    >
                      Hủy mã
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Nhập mã giảm giá (VD: GIAM20K)..."
                      value={promoCode}
                      onChange={(e) =>
                        setPromoCode(e.target.value.toUpperCase())
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleApplyVoucher();
                      }}
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:bg-white font-mono uppercase"
                    />
                    <button
                      onClick={handleApplyVoucher}
                      className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
                    >
                      Áp dụng
                    </button>
                  </div>
                )}
                {voucherNotice && (
                  <p className="text-[11px] text-amber-700">{voucherNotice}</p>
                )}
              </div>

              {/* Thanh toán nhiều hình thức (tiền mặt + chuyển khoản + thẻ) */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <label className="text-[11px] font-bold text-slate-700">
                  Thanh toán (có thể kết hợp nhiều hình thức)
                </label>

                {/* Chuyển khoản */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <QrCode className="w-4 h-4" /> Chuyển khoản (VietQR):
                    </span>
                    <input
                      type="number"
                      value={transferAmount || ""}
                      onChange={(e) =>
                        setTransferAmount(Math.max(0, Number(e.target.value)))
                      }
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
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4" /> Thẻ:
                    </span>
                    <input
                      type="number"
                      value={cardAmount || ""}
                      onChange={(e) =>
                        setCardAmount(Math.max(0, Number(e.target.value)))
                      }
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
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <Banknote className="w-4 h-4" /> Tiền mặt khách đưa:
                    </span>
                    <input
                      type="number"
                      value={cashGiven || ""}
                      onChange={(e) =>
                        setCashGiven(Math.max(0, Number(e.target.value)))
                      }
                      placeholder="Nhập số tiền..."
                      className="w-32 px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold text-xs"
                    />
                  </div>
                  <div className="flex gap-1 justify-end">
                    {[100000, 200000, 500000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setCashGiven(amt)}
                        className="px-2 py-0.5 text-[10px] bg-white border border-slate-300 rounded hover:bg-slate-100 font-medium"
                      >
                        {amt / 1000}k
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
                  <span>
                    {isPaidEnough ? "Tiền thừa trả khách:" : "Còn thiếu:"}
                  </span>
                  <span
                    className={
                      isPaidEnough ? "text-emerald-700" : "text-rose-600"
                    }
                  >
                    {(isPaidEnough
                      ? changeAmount
                      : Math.max(0, finalTotal - totalReceived)
                    ).toLocaleString("vi-VN")}{" "}
                    đ
                  </span>
                </div>
              </div>

              {/* Vùng 5: Order Summary Breakdown (số liệu từ server) */}
              <div className="bg-slate-50 p-3 rounded-lg space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Tổng tiền hàng:</span>
                  <span>{subtotal.toLocaleString("vi-VN")} đ</span>
                </div>
                {preview?.promotions.map((p) => (
                  <div
                    key={p.promotionId}
                    className="flex justify-between text-rose-600"
                  >
                    <span>KM {p.code}:</span>
                    <span>-{p.discountAmount.toLocaleString("vi-VN")} đ</span>
                  </div>
                ))}
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>Tổng giảm giá:</span>
                    <span>-{totalDiscount.toLocaleString("vi-VN")} đ</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-[#004885] pt-1.5 border-t border-slate-200">
                  <span>KHÁCH PHẢI TRẢ:</span>
                  <span>
                    {previewing
                      ? "..."
                      : `${finalTotal.toLocaleString("vi-VN")} đ`}
                  </span>
                </div>
              </div>

              {/* Vùng 6: Complete Sale Button */}
              <button
                id="btn-checkout-sale"
                onClick={handleCheckout}
                disabled={!canCheckout}
                className="w-full py-3 rounded-xl bg-[#004885] hover:bg-[#00386b] disabled:bg-slate-300 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                <span>
                  {checkingOut ? "Đang xử lý..." : "Hoàn tất & In hóa đơn"}
                </span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono">
                  F9
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Vùng 7: SUBTAB Lịch sử hóa đơn */
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Danh sách hóa đơn bán hàng
              </h3>
              <p className="text-xs text-slate-500">
                Tra cứu hóa đơn đã bán và in lại hóa đơn cho khách
              </p>
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
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-bold text-[#004885]">
                      {inv.code}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {inv.createdAt}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800">
                      {inv.cashierName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {PAYMENT_METHOD_LABELS[inv.paymentMethod]}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {inv.items.length} mặt hàng
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {inv.finalTotal.toLocaleString("vi-VN")} đ
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : inv.status === "returned"
                              ? "bg-amber-100 text-amber-800"
                              : inv.status === "pending_payment" ||
                                  inv.status === "pending_approval"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => setPrintInvoice(inv)}
                        className="px-2 py-1 rounded bg-sky-50 text-[#004885] hover:bg-sky-100 font-semibold text-[11px] inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Xem / In</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vùng 8: Xem / in hóa đơn (UC10) */}
      <InvoiceModal
        invoice={printInvoice}
        onClose={() => setPrintInvoice(null)}
      />
    </div>
  );
};
