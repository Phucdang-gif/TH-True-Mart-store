import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Banknote,
  QrCode,
  Tag,
  RotateCcw,
  XCircle,
  Eye,
  AlertTriangle,
} from "lucide-react";
import {
  Product,
  Batch,
  Invoice,
  CartItem,
  Staff,
  PaymentMethod,
} from "../../types";
import {
  CATEGORY_LABELS,
  CATEGORY_LIST,
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from "../../lib/labels";
import {
  ApprovalPayload,
  CreateInvoicePayload,
  InvoicePreview,
  PaymentPayload,
  invoicesApi,
} from "../../services/invoices";
import { InvoiceModal } from "../InvoiceModal";

interface BanHangPOSProps {
  products: Product[];
  batches: Batch[];
  currentStaff: Staff; // nhân viên đang đăng nhập (thu ngân / quản lý)
  invoices: Invoice[];
  // Lập hóa đơn: server tính tiền, trừ kho, ghi thanh toán rồi trả hóa đơn hoàn chỉnh
  onCompleteSale: (payload: CreateInvoicePayload) => Promise<Invoice>;
  // Đổi trả / hủy: chỉ quản lý (server kiểm tra quyền)
  onReturnInvoice: (invoiceId: string, approval: ApprovalPayload) => Promise<void>;
  onCancelInvoice: (invoiceId: string, approval: ApprovalPayload) => Promise<void>;
}

// Bỏ dấu tiếng Việt để tìm "sua chua" ra "Sữa chua"
const normalizeText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

// Giảm giá riêng của sản phẩm trên 1 đơn vị (khớp công thức ở server: làm tròn VND)
const unitDiscountOf = (p: Product) =>
  p.discountPercent && p.discountPercent > 0
    ? Math.round((p.sellingPrice * p.discountPercent) / 100)
    : 0;

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Đã có lỗi xảy ra");

export const BanHangPOS: React.FC<BanHangPOSProps> = ({
  products,
  batches,
  currentStaff,
  invoices,
  onCompleteSale,
  onReturnInvoice,
  onCancelInvoice,
}) => {
  const [subTab, setSubTab] = useState<"pos" | "history">("pos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Khuyến mãi: mã đang áp dụng; số tiền giảm do server tính (preview)
  const [promoCode, setPromoCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [isPricing, setIsPricing] = useState(false);
  const previewSeq = useRef(0); // bỏ qua kết quả tính giá cũ khi giỏ hàng đổi liên tục

  // Payment state: thanh toán nhiều hình thức (bảng invoice_payments)
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferRef, setTransferRef] = useState("");
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [cardRef, setCardRef] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hóa đơn vừa lập / đang xem (InvoiceModal)
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  // Return / Cancel modal state
  const [selectedInvoiceForAction, setSelectedInvoiceForAction] =
    useState<Invoice | null>(null);
  const [actionType, setActionType] = useState<"return" | "cancel" | null>(
    null,
  );
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>("cash");
  const [refundRef, setRefundRef] = useState("");
  const isManager = currentStaff.role === "manager"; // quyền invoice:approve

  // Categories list (mã enum của DB)
  const categories: string[] = ["all", ...CATEGORY_LIST];

  // ───────────── Tra cứu sản phẩm + tồn kho (lô còn hạn) ─────────────
  const isSellable = (b: Batch) =>
    b.quantity > 0 && new Date(b.expiryDate).getTime() > Date.now();

  const stockOf = (productId: string) =>
    batches
      .filter((b) => b.productId === productId && isSellable(b))
      .reduce((sum, b) => sum + b.quantity, 0);

  // Lô sẽ được xuất trước (hết hạn sớm nhất, còn hạn dùng) - server phân bổ lô thật khi lập hóa đơn
  const getFIFOBatch = (productId: string): Batch | undefined => {
    return batches
      .filter((b) => b.productId === productId && isSellable(b))
      .sort(
        (a, b) =>
          new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
      )[0];
  };

  // Tìm theo tên / mã, không phân biệt hoa thường và dấu; nhiều từ khóa phải khớp hết
  const tokens = normalizeText(searchQuery).split(/\s+/).filter(Boolean);
  const filteredProducts = products.filter((p) => {
    if (p.status !== "active") return false;
    const matchesCat =
      selectedCategory === "all" || p.category === selectedCategory;
    const haystack = normalizeText(`${p.name} ${p.code}`);
    return matchesCat && tokens.every((t) => haystack.includes(t));
  });

  // ───────────── Giỏ hàng ─────────────
  const buildCartItem = (
    product: Product,
    quantity: number,
    selectedBatch?: Batch,
  ): CartItem => {
    const unitPrice = product.sellingPrice;
    const discount = unitDiscountOf(product);
    return {
      product,
      selectedBatch,
      quantity,
      unitPrice,
      discount,
      total: (unitPrice - discount) * quantity,
    };
  };

  const addToCart = (product: Product) => {
    const stock = stockOf(product.id);
    const existing = cart.find((item) => item.product.id === product.id);
    const nextQty = (existing?.quantity ?? 0) + 1;
    if (stock <= 0) {
      alert(`"${product.name}" đã hết hàng hoặc các lô còn lại đã hết hạn!`);
      return;
    }
    if (nextQty > stock) {
      alert(`"${product.name}" chỉ còn ${stock} trong kho!`);
      return;
    }
    if (existing) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? buildCartItem(product, nextQty, item.selectedBatch)
            : item,
        ),
      );
    } else {
      setCart([...cart, buildCartItem(product, 1, getFIFOBatch(product.id))]);
    }
  };

  // Change quantity
  const updateQuantity = (index: number, delta: number) => {
    const item = cart[index];
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter((_, i) => i !== index));
      return;
    }
    const stock = stockOf(item.product.id);
    if (newQty > stock) {
      alert(`"${item.product.name}" chỉ còn ${stock} trong kho!`);
      return;
    }
    setCart(
      cart.map((c, i) =>
        i === index ? buildCartItem(c.product, newQty, c.selectedBatch) : c,
      ),
    );
  };

  // ───────────── Tính tiền + khuyến mãi (server là nguồn tính toán duy nhất) ─────────────
  const cartKey = cart.map((i) => `${i.product.id}:${i.quantity}`).join("|");
  useEffect(() => {
    const seq = ++previewSeq.current;
    if (cart.length === 0) {
      setPreview(null);
      setIsPricing(false);
      return;
    }
    setIsPricing(true);
    const timer = setTimeout(async () => {
      try {
        const result = await invoicesApi.preview(
          cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          appliedCode ?? undefined,
        );
        if (seq !== previewSeq.current) return;
        setPreview(result);
      } catch (e) {
        if (seq !== previewSeq.current) return;
        if (appliedCode) {
          // Giỏ hàng đổi làm mã không còn hợp lệ (VD: dưới giá trị tối thiểu)
          alert(`${errMsg(e)}\nMã ${appliedCode} đã được gỡ khỏi đơn.`);
          setAppliedCode(null);
        } else {
          setPreview(null);
          alert(errMsg(e));
        }
      } finally {
        if (seq === previewSeq.current) setIsPricing(false);
      }
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, appliedCode]);

  const subtotal = preview?.subtotal ?? 0;
  const productDiscount = preview?.productDiscount ?? 0;
  const promotionDiscount = preview?.promotionDiscount ?? 0;
  const totalDiscount = preview?.discountAmount ?? 0;
  const finalTotal = preview?.finalTotal ?? 0;
  const appliedPromotions = preview?.appliedPromotions ?? [];

  // Tổng hợp các khoản thanh toán: chuyển khoản/thẻ không được vượt phần còn lại, tiền mặt được đưa dư để thối
  const nonCashPaid = transferAmount + cardAmount;
  const cashDue = Math.max(0, finalTotal - nonCashPaid); // phần phải trả bằng tiền mặt
  const totalReceived = cashGiven + nonCashPaid;
  const changeAmount = Math.max(0, totalReceived - finalTotal);
  const isPaidEnough =
    !!preview && totalReceived >= finalTotal && nonCashPaid <= finalTotal;

  // Áp dụng mã khuyến mãi: server kiểm tra hiệu lực, lượt dùng, giá trị tối thiểu
  const handleApplyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    if (cart.length === 0) {
      alert("Vui lòng thêm sản phẩm vào giỏ trước khi áp dụng mã!");
      return;
    }
    try {
      const result = await invoicesApi.preview(
        cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        code,
      );
      if (!result.voucherCode) {
        alert("Mã khuyến mãi không áp dụng được cho đơn hàng này!");
        return;
      }
      setPreview(result);
      setAppliedCode(result.voucherCode);
      setPromoCode("");
    } catch (e) {
      alert(errMsg(e));
    }
  };

  // Handle Checkout
  const handleCheckout = async () => {
    if (isSubmitting) return;
    if (cart.length === 0) {
      alert("Giỏ hàng trống! Vui lòng chọn sản phẩm.");
      return;
    }
    if (nonCashPaid > finalTotal) {
      alert("Tổng chuyển khoản + thẻ không được vượt quá số tiền phải trả!");
      return;
    }
    if (!isPaidEnough) {
      alert(
        "Số tiền thanh toán chưa đủ! Hóa đơn chỉ hoàn tất khi tổng các khoản đã nhận >= số tiền phải trả.",
      );
      return;
    }
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

    const payments: PaymentPayload[] = [];
    if (cashGiven > 0) payments.push({ method: "cash", amount: cashGiven });
    if (transferAmount > 0) {
      payments.push({
        method: "transfer",
        amount: transferAmount,
        reference: transferRef.trim(),
      });
    }
    if (cardAmount > 0) {
      payments.push({
        method: "card",
        amount: cardAmount,
        reference: cardRef.trim(),
      });
    }
    if (payments.length === 0) payments.push({ method: "cash", amount: 0 });

    setIsSubmitting(true);
    try {
      const invoice = await onCompleteSale({
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
        voucherCode: appliedCode ?? undefined,
        payments,
        notes: notes.trim() || undefined,
      });

      // Thành công: hiện hóa đơn để in, làm mới giỏ hàng
      setViewInvoice(invoice);
      setCart([]);
      setPreview(null);
      setAppliedCode(null);
      setPromoCode("");
      setCashGiven(0);
      setTransferAmount(0);
      setTransferRef("");
      setCardAmount(0);
      setCardRef("");
      setNotes("");
    } catch (e) {
      alert(`Không thể lập hóa đơn: ${errMsg(e)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeActionDialog = () => {
    setSelectedInvoiceForAction(null);
    setActionType(null);
    setActionError("");
    setRefundMethod("cash");
    setRefundRef("");
  };

  // Xác nhận đổi trả / hủy hóa đơn
  const handleConfirmAction = async () => {
    if (!selectedInvoiceForAction || !actionType || isSubmitting) return;
    if (refundMethod === "transfer" && !refundRef.trim()) {
      setActionError("Vui lòng nhập mã giao dịch hoàn tiền chuyển khoản.");
      return;
    }
    const approval: ApprovalPayload = {
      reason:
        actionReason.trim() ||
        (actionType === "return" ? "Khách đổi trả" : "Hủy hóa đơn sai sót"),
      refundMethod: refundMethod as ApprovalPayload["refundMethod"],
      refundRef: refundMethod === "transfer" ? refundRef.trim() : undefined,
    };
    setIsSubmitting(true);
    setActionError("");
    try {
      if (actionType === "return") {
        await onReturnInvoice(selectedInvoiceForAction.id, approval);
      } else {
        await onCancelInvoice(selectedInvoiceForAction.id, approval);
      }
      closeActionDialog();
    } catch (e) {
      setActionError(errMsg(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub navigation between POS & Invoice History (1.4 Return / Cancel) */}
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
            1.4 Đổi trả & Hủy hóa đơn ({invoices.length})
          </button>
        </div>
      </div>

      {subTab === "pos" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT 7 COLS: Product Catalog & Search (1.1) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Tra cứu sản phẩm (tên / mã) */}
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
                    placeholder="Tìm theo tên sản phẩm hoặc mã (VD: sữa chua, TH-MILK)..."
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
                const stock = stockOf(product.id);
                const isExpiringSoon =
                  !!availableBatch &&
                  (new Date(availableBatch.expiryDate).getTime() - Date.now()) /
                    86400000 <=
                    30;

                return (
                  <div
                    key={product.id}
                    id={`product-card-${product.id}`}
                    onClick={() => addToCart(product)}
                    className={`bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between transition-all group relative overflow-hidden ${
                      stock > 0
                        ? "hover:border-sky-500 hover:shadow-md cursor-pointer"
                        : "opacity-60 cursor-not-allowed"
                    }`}
                  >
                    {!!product.discountPercent && product.discountPercent > 0 && (
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
                            HSD {availableBatch.expiryDate.slice(0, 10)}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                          Hết hàng trong kho
                        </div>
                      )}
                      {stock > 0 && (
                        <p className="text-[10px] text-slate-500">
                          Tồn kho (còn hạn): {stock}
                        </p>
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

              {/* Cart List */}
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 space-y-1">
                    <p className="text-xs">Chưa có sản phẩm nào trong đơn.</p>
                    <p className="text-[11px]">
                      Bấm vào sản phẩm bên trái để thêm.
                    </p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {item.product.name}
                        </p>
                        <span className="text-xs font-bold text-[#004885]">
                          {(item.unitPrice - item.discount).toLocaleString(
                            "vi-VN",
                          )}{" "}
                          đ
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
                        <span className="text-xs font-bold px-1.5 min-w-[20px] text-center">
                          {item.quantity}
                        </span>
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
                {appliedCode ? (
                  <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                    <span className="font-bold">
                      ✓ {appliedCode}
                      {appliedPromotions.find((a) => a.code === appliedCode)
                        ? `: ${appliedPromotions.find((a) => a.code === appliedCode)!.name}`
                        : ""}
                    </span>
                    <button
                      onClick={() => setAppliedCode(null)}
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
                      onChange={(e) =>
                        setPromoCode(e.target.value.toUpperCase())
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleApplyPromo();
                      }}
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

              {/* Order Summary Breakdown */}
              <div className="bg-slate-50 p-3 rounded-lg space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Tổng tiền hàng:</span>
                  <span>{subtotal.toLocaleString("vi-VN")} đ</span>
                </div>
                {productDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>Giảm giá sản phẩm:</span>
                    <span>-{productDiscount.toLocaleString("vi-VN")} đ</span>
                  </div>
                )}
                {appliedPromotions.map((a) => (
                  <div
                    key={a.promotionId}
                    className="flex justify-between text-rose-600 font-medium"
                  >
                    <span className="truncate pr-2">
                      Khuyến mãi {a.code}:
                    </span>
                    <span>-{a.discountAmount.toLocaleString("vi-VN")} đ</span>
                  </div>
                ))}
                {promotionDiscount > 0 && appliedPromotions.length > 1 && (
                  <div className="flex justify-between text-slate-600 font-medium border-t border-slate-200 pt-1">
                    <span>Tổng giảm giá:</span>
                    <span>-{totalDiscount.toLocaleString("vi-VN")} đ</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-[#004885] pt-1.5 border-t border-slate-200">
                  <span>KHÁCH PHẢI TRẢ:</span>
                  <span>{finalTotal.toLocaleString("vi-VN")} đ</span>
                </div>
              </div>

              {/* Complete Sale Button */}
              <button
                id="btn-checkout-sale"
                onClick={handleCheckout}
                disabled={
                  cart.length === 0 || !isPaidEnough || isPricing || isSubmitting
                }
                className="w-full py-3 rounded-xl bg-[#004885] hover:bg-[#00386b] disabled:bg-slate-300 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                <span>
                  {isSubmitting ? "Đang lập hóa đơn..." : "Hoàn tất & In hóa đơn"}
                </span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono">
                  F9
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* SUBTAB 1.4: Đổi trả, hủy hóa đơn (Invoice History & Returns) */
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Danh sách hóa đơn bán hàng
              </h3>
              <p className="text-xs text-slate-500">
                Tra cứu hóa đơn, thực hiện nghiệp vụ đổi trả hàng hoặc hủy hóa
                đơn sai sót
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
                        onClick={() => setViewInvoice(inv)}
                        className="px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-[11px] inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Xem</span>
                      </button>
                      {inv.status === "completed" && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedInvoiceForAction(inv);
                              setActionType("return");
                              setActionReason("");
                              setActionError("");
                            }}
                            className="px-2 py-1 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold text-[11px] inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Đổi trả</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedInvoiceForAction(inv);
                              setActionType("cancel");
                              setActionReason("");
                              setActionError("");
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
                {actionType === "return"
                  ? "Xử lý đổi trả hàng (Hóa đơn "
                  : "Xác nhận hủy hóa đơn ("}
                {selectedInvoiceForAction.code})
              </span>
            </div>

            <p className="text-xs text-slate-600">
              {actionType === "return"
                ? "Sản phẩm đổi trả sẽ được hoàn lại vào kho hàng. Vui lòng ghi rõ lý do (VD: Khách đổi sang sữa ít đường, vỏ hộp móp méo...):"
                : "Hóa đơn sẽ chuyển sang trạng thái ĐÃ HỦY và hoàn lại số lượng tồn kho của các mặt hàng. Thao tác này không thể hoàn tác."}
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
                <span className="font-bold text-slate-900">
                  {selectedInvoiceForAction.finalTotal.toLocaleString("vi-VN")}{" "}
                  đ
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Hoàn bằng:</span>
                <select
                  value={refundMethod}
                  onChange={(e) =>
                    setRefundMethod(e.target.value as PaymentMethod)
                  }
                  className="px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                >
                  <option value="cash">{PAYMENT_METHOD_LABELS.cash}</option>
                  <option value="transfer">
                    {PAYMENT_METHOD_LABELS.transfer}
                  </option>
                  <option value="card">{PAYMENT_METHOD_LABELS.card}</option>
                </select>
              </div>
              {refundMethod === "transfer" && (
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
                  Bạn không có quyền duyệt. Thao tác cần Quản lý xác nhận
                  (invoice:approve) trước khi hoàn tiền.
                </p>
              )}
            </div>

            {actionError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
                {actionError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={closeActionDialog}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Hủy bỏ
              </button>
              <button
                disabled={!isManager || isSubmitting}
                onClick={handleConfirmAction}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed ${
                  actionType === "return"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {isSubmitting
                  ? "Đang xử lý..."
                  : actionType === "return"
                    ? "Xác nhận đổi trả"
                    : "Xác nhận hủy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hóa đơn vừa lập / đang xem (in được) */}
      <InvoiceModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />
    </div>
  );
};
