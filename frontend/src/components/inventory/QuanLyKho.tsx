import React, { useState, useEffect } from "react";
import {
  Warehouse,
  AlertTriangle,
  PlusCircle,
  ClipboardCheck,
  Search,
  CheckCircle2,
  X,
  Inbox,
  Package,
  Calendar,
} from "lucide-react";
import { Product, Batch, StockAudit, StockAuditItem, Staff } from "../../types";
import { fetchApi } from "../../lib/api";

interface QuanLyKhoProps {
  products: Product[];
  onAdjustStock: (batchId: string, newQuantity: number, reason: string) => void;
  currentStaff: Staff;
  audits: StockAudit[];
  onSubmitAudit: (audit: StockAudit) => void;
  onReviewAudit: (
    auditId: string,
    approved: boolean,
    approverId: string,
  ) => void;
}

export const QuanLyKho: React.FC<QuanLyKhoProps> = ({
  products,
  onAdjustStock,
  currentStaff,
  audits,
  onSubmitAudit,
  onReviewAudit,
}) => {
  const [activeTab, setActiveTab] = useState<
    "batches" | "alerts" | "audit" | "pending_pos"
  >("batches");
  const [search, setSearch] = useState("");

  // === DATA TỪ API ===
  const [batches, setBatches] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // === GỌI API ===
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [batchesRes, suppliersRes, poRes] = await Promise.all([
        fetchApi<any>("/api/batches").catch(() => []),
        fetchApi<any>("/api/suppliers").catch(() => []),
        fetchApi<any>("/api/purchase-orders").catch(() => []),
      ]);

      const batchesArray = Array.isArray(batchesRes)
        ? batchesRes
        : batchesRes?.data || [];
      const suppliersArray = Array.isArray(suppliersRes)
        ? suppliersRes
        : suppliersRes?.data || [];
      const poArray = Array.isArray(poRes) ? poRes : poRes?.data || [];

      setBatches(batchesArray);
      setSuppliers(suppliersArray);
      setPurchaseOrders(poArray);
    } catch (error) {
      console.error("Lỗi tải dữ liệu kho:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Lọc PO đang chờ nhập kho
  const pendingPOs = purchaseOrders.filter((po) => po.status === "pending");

  // Stock Audit State (3.3)
  const [auditItems, setAuditItems] = useState<{ [key: string]: number }>({});
  const [auditSaved, setAuditSaved] = useState(false);

  // Modal State cho việc Nhập kho từ PO
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [receiptItems, setReceiptItems] = useState<any[]>([]);
  const [receiptNotes, setReceiptNotes] = useState("");
  const [savingReceipt, setSavingReceipt] = useState(false);

  // Tính số ngày còn lại của lô hàng
  const getDaysLeft = (expiryDateStr: string) => {
    const today = new Date();
    const exp = new Date(expiryDateStr);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const expiringBatches = batches.filter(
    (b) => getDaysLeft(b.expiryDate) <= 30 && b.quantity > 0,
  );
  const criticalExpiringBatches = batches.filter(
    (b) => getDaysLeft(b.expiryDate) <= 15 && b.quantity > 0,
  );
  const filteredBatches = batches.filter((b) => {
    const product = products.find((p) => p.id === b.productId);
    return (
      b.batchCode.toLowerCase().includes(search.toLowerCase()) ||
      (product && product.name.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const formatDate = (isoString: string) =>
    isoString ? new Date(isoString).toLocaleDateString("vi-VN") : "";

  // === MỞ MODAL NHẬP KHO CHO 1 PO ===
  const handleOpenReceivePO = (po: any) => {
    setSelectedPO(po);
    setReceiptNotes("");

    // Tự động map sản phẩm từ PO sang form nhập kho
    const initialItems = (po.purchase_order_items || po.items || []).map(
      (item: any) => {
        const prodName = item.products?.name || item.productName || "Sản phẩm";
        return {
          productId: item.productId,
          productName: prodName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          batchCode: `LOTH-${new Date().toISOString().slice(0, 7).replace("-", "")}-${Math.floor(100 + Math.random() * 900)}`,
          manufacturingDate: new Date().toISOString().split("T")[0],
          expiryDate: "", // Bắt buộc thủ kho phải soi hộp sữa để điền
        };
      },
    );

    setReceiptItems(initialItems);
    setShowReceiveModal(true);
  };

  const handleReceiptItemChange = (
    index: number,
    field: string,
    value: any,
  ) => {
    const updated = [...receiptItems];
    updated[index] = { ...updated[index], [field]: value };
    setReceiptItems(updated);
  };

  // === SUBMIT NHẬP KHO LÊN BACKEND ===
  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;

    // Ràng buộc phải nhập HSD
    if (receiptItems.some((i) => !i.expiryDate)) {
      alert("Vui lòng nhập Hạn sử dụng (HSD) cho tất cả các sản phẩm!");
      return;
    }

    setSavingReceipt(true);
    try {
      await fetchApi("/api/goods-receipts", {
        method: "POST",
        body: JSON.stringify({
          supplierId: selectedPO.supplierId,
          purchaseOrderId: selectedPO.id,
          notes: receiptNotes,
          items: receiptItems.map((i) => ({
            productId: i.productId,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
            batchCode: i.batchCode,
            manufacturingDate: new Date(i.manufacturingDate).toISOString(),
            expiryDate: new Date(i.expiryDate).toISOString(),
          })),
        }),
      });

      await fetchData(); // Tải lại toàn bộ kho & danh sách PO
      setShowReceiveModal(false);
      setSelectedPO(null);
      setActiveTab("batches"); // Chuyển về tab Thẻ kho để xem lô vừa nhập
      alert("Nhập kho thành công!");
    } catch (error: any) {
      alert("Lỗi khi nhập kho: " + error.message);
    } finally {
      setSavingReceipt(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 3.4 Cảnh báo nguy cấp (Giữ nguyên) */}
      {criticalExpiringBatches.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start justify-between gap-3 text-rose-900 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-100 rounded-lg text-rose-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs">
                CẢNH BÁO: Có {criticalExpiringBatches.length} lô hàng cận hạn sử
                dụng nguy cấp (≤ 15 ngày)!
              </h4>
              <p className="text-[11px] text-rose-700 mt-0.5">
                Đặc thù sữa thanh trùng và sữa chua tươi cần ưu tiên xuất bán
                gấp (FIFO) hoặc áp dụng mã giảm giá thanh lý.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("alerts")}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 transition-colors"
          >
            Xem ngay
          </button>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          {/* TAB MỚI THÊM VÀO: Đơn chờ nhập */}
          <button
            onClick={() => setActiveTab("pending_pos")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "pending_pos"
                ? "bg-amber-100 text-amber-800 shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Đơn chờ nhập kho ({pendingPOs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("batches")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "batches"
                ? "bg-[#004885] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Warehouse className="w-3.5 h-3.5" />
            <span>Thẻ kho ({batches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("alerts")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "alerts"
                ? "bg-[#004885] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Cảnh báo cận hạn ({expiringBatches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "audit"
                ? "bg-[#004885] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Kiểm kê tồn kho</span>
          </button>
        </div>
      </div>

      {/* NỘI DUNG TAB: ĐƠN CHỜ NHẬP KHO TỪ NHÀ CUNG CẤP */}
      {activeTab === "pending_pos" && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-10 text-slate-500">
              Đang tải danh sách đơn đặt hàng...
            </div>
          ) : pendingPOs.length === 0 ? (
            <div className="p-10 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
              <Inbox className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p>
                Hiện không có đơn đặt hàng nào đang chờ nhập kho từ Nhà cung
                cấp.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingPOs.map((po) => (
                <div
                  key={po.id}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3 border-l-4 border-l-amber-400"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono font-bold text-sm text-[#004885]">
                        {po.orderCode}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        Chờ tiếp nhận
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      {po.suppliers?.name || po.supplierName}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Dự kiến giao:{" "}
                      <strong className="text-slate-700">
                        {formatDate(po.expectedDate)}
                      </strong>
                    </p>
                    <div className="mt-3 space-y-1">
                      {(po.purchase_order_items || po.items || []).map(
                        (item: any, idx: number) => (
                          <p
                            key={idx}
                            className="text-xs text-slate-600 truncate"
                          >
                            • {item.products?.name || item.productName} (
                            <strong className="text-slate-900">
                              {item.quantity}
                            </strong>
                            )
                          </p>
                        ),
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenReceivePO(po)}
                    className="w-full py-2 bg-[#004885] hover:bg-[#00386b] text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Package className="w-4 h-4" />
                    Bắt đầu Kiểm đếm & Nhập kho
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CÁC TAB CŨ (GIỮ NGUYÊN HOÀN TOÀN) */}
      {activeTab === "batches" && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo số lô (LOTH-...), tên sữa..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:bg-white"
            />
          </div>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-5 text-slate-500 text-sm">
                Đang tải dữ liệu lô hàng...
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">Mã Lô Hàng</th>
                    <th className="py-2.5 px-3">Sản phẩm TH True Milk</th>
                    <th className="py-2.5 px-3">Ngày sản xuất (NSX)</th>
                    <th className="py-2.5 px-3">Hạn sử dụng (HSD)</th>
                    <th className="py-2.5 px-3 text-center">Số ngày còn</th>
                    <th className="py-2.5 px-3 text-right">Số lượng tồn</th>
                    <th className="py-2.5 px-3 text-center">
                      Trạng thái hạn dùng
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBatches.map((batch) => {
                    const prod = products.find((p) => p.id === batch.productId);
                    const daysLeft = getDaysLeft(batch.expiryDate);
                    return (
                      <tr
                        key={batch.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-[#004885]">
                          {batch.batchCode}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {prod?.name || "Sản phẩm TH"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {formatDate(batch.manufacturingDate)}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {formatDate(batch.expiryDate)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-bold ${daysLeft <= 0 ? "text-rose-600" : daysLeft <= 15 ? "text-rose-600" : daysLeft <= 30 ? "text-amber-600" : "text-slate-700"}`}
                          >
                            {daysLeft > 0 ? `${daysLeft} ngày` : "Đã hết hạn!"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {batch.quantity} {prod?.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${daysLeft <= 0 ? "bg-rose-100 text-rose-800" : daysLeft <= 15 ? "bg-rose-100 text-rose-700 animate-pulse" : daysLeft <= 30 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}
                          >
                            {daysLeft <= 0
                              ? "Đã hết hạn"
                              : daysLeft <= 15
                                ? "Nguy cấp (≤15 ngày)"
                                : daysLeft <= 30
                                  ? "Cận date (≤30 ngày)"
                                  : "Đảm bảo"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === "alerts" && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Danh sách lô hàng cận hạn sử dụng</span>
              </h3>
            </div>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
              {expiringBatches.length} lô cần xử lý
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Mã Lô</th>
                  <th className="py-2.5 px-3">Tên sản phẩm</th>
                  <th className="py-2.5 px-3">Hạn sử dụng</th>
                  <th className="py-2.5 px-3 text-center">Thời gian còn lại</th>
                  <th className="py-2.5 px-3 text-right">Số lượng tồn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expiringBatches.map((b) => {
                  const prod = products.find((p) => p.id === b.productId);
                  const days = getDaysLeft(b.expiryDate);
                  return (
                    <tr key={b.id} className="hover:bg-amber-50/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#004885]">
                        {b.batchCode}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {prod?.name}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-rose-700">
                        {formatDate(b.expiryDate)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${days <= 15 ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}
                        >
                          Còn {days} ngày
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {b.quantity} {prod?.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Phiếu kiểm kê tồn kho cửa hàng
              </h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Mã Lô</th>
                  <th className="py-2.5 px-3">Sản phẩm TH</th>
                  <th className="py-2.5 px-3 text-right">SL Hệ thống</th>
                  <th className="py-2.5 px-3 text-right">
                    SL Thực tế đếm được
                  </th>
                  <th className="py-2.5 px-3 text-right">Chênh lệch</th>
                  <th className="py-2.5 px-3">Lý do điều chỉnh (nếu có)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.slice(0, 6).map((b) => {
                  const prod = products.find((p) => p.id === b.productId);
                  const actualCount =
                    auditItems[b.id] !== undefined
                      ? auditItems[b.id]
                      : b.quantity;
                  const diff = actualCount - b.quantity;
                  return (
                    <tr key={b.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#004885]">
                        {b.batchCode}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {prod?.name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                        {b.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          value={actualCount}
                          onChange={(e) =>
                            setAuditItems({
                              ...auditItems,
                              [b.id]: Number(e.target.value),
                            })
                          }
                          className="w-20 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-right font-bold text-xs"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        <span
                          className={
                            diff === 0
                              ? "text-slate-400"
                              : diff > 0
                                ? "text-emerald-700"
                                : "text-rose-600"
                          }
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {diff < 0
                          ? "Bao bì móp méo / vỡ hỏng"
                          : diff > 0
                            ? "Thừa khi nhập hàng"
                            : "Khớp"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: KIỂM ĐẾM & NHẬP KHO TỪ PO */}
      {showReceiveModal && selectedPO && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Nghiệp vụ Nhập kho & Sinh lô hàng
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Đơn hàng:{" "}
                  <strong className="font-mono text-[#004885]">
                    {selectedPO.orderCode}
                  </strong>{" "}
                  • Đối tác:{" "}
                  <strong className="text-slate-800">
                    {selectedPO.suppliers?.name || selectedPO.supplierName}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setShowReceiveModal(false)}
                className="text-slate-400 hover:bg-slate-100 p-2 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 bg-slate-50">
              <form
                id="receiptForm"
                onSubmit={handleSubmitReceipt}
                className="space-y-4"
              >
                {receiptItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-[#004885] text-sm">
                        {item.productName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          SL Thực nhận
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) =>
                            handleReceiptItemChange(
                              idx,
                              "quantity",
                              e.target.value,
                            )
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-emerald-700"
                          required
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          Giá nhập (đ)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleReceiptItemChange(
                              idx,
                              "unitPrice",
                              e.target.value,
                            )
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                          required
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          Mã Lô (Tự sinh)
                        </label>
                        <input
                          type="text"
                          value={item.batchCode}
                          onChange={(e) =>
                            handleReceiptItemChange(
                              idx,
                              "batchCode",
                              e.target.value,
                            )
                          }
                          className="w-full p-2 bg-amber-50 border border-amber-200 rounded-lg font-mono font-bold"
                          required
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          Ngày SX (NSX)
                        </label>
                        <input
                          type="date"
                          value={item.manufacturingDate}
                          onChange={(e) =>
                            handleReceiptItemChange(
                              idx,
                              "manufacturingDate",
                              e.target.value,
                            )
                          }
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                          required
                        />
                      </div>
                      <div>
                        <label className="font-bold text-red-600 block mb-1">
                          Hạn sử dụng (HSD)*
                        </label>
                        <input
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) =>
                            handleReceiptItemChange(
                              idx,
                              "expiryDate",
                              e.target.value,
                            )
                          }
                          className="w-full p-2 bg-red-50 border border-red-200 rounded-lg font-bold outline-none ring-2 ring-red-100 focus:ring-red-400"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-sm">
                    Ghi chú phiếu nhập
                  </label>
                  <textarea
                    rows={2}
                    value={receiptNotes}
                    onChange={(e) => setReceiptNotes(e.target.value)}
                    placeholder="Tình trạng hàng hóa lúc nhận, biển số xe tải..."
                    className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-sm"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                form="receiptForm"
                disabled={savingReceipt}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm shadow-sm disabled:opacity-60 flex items-center gap-2"
              >
                {savingReceipt
                  ? "Đang xử lý..."
                  : "Xác nhận Nhập kho & Sinh Lô"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
