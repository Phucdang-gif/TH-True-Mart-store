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
import { stockAuditService } from "../../services/stock-audits";

interface QuanLyKhoProps {
  products: Product[];
  onAdjustStock: (batchId: string, newQuantity: number, reason: string) => void;
  currentStaff: Staff;
}

export const QuanLyKho: React.FC<QuanLyKhoProps> = ({
  products,
  onAdjustStock,
  currentStaff,
}) => {
  const [activeTab, setActiveTab] = useState<
    "batches" | "alerts" | "audit" | "pending_pos"
  >("batches");
  const [search, setSearch] = useState("");

  // === DATA TỪ API ===
  const [batches, setBatches] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [auditSubmitting, setAuditSubmitting] = useState(false);
  const [detailAudit, setDetailAudit] = useState<StockAudit | null>(null);

  // Tải lại phiếu kiểm kê từ DB
  const fetchAudits = async () => {
    try {
      setAudits(await stockAuditService.getAll());
    } catch (error) {
      console.error("Lỗi tải phiếu kiểm kê:", error);
    }
  };

  // === GỌI API ===
  const fetchData = async () => {
    setIsLoading(true);
    try {
      fetchAudits();
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

  // === Stock Audit State (Kiểm kê) ===
  const [auditItems, setAuditItems] = useState<{ [key: string]: number }>({});
  const [auditReasons, setAuditReasons] = useState<{ [key: string]: string }>(
    {},
  ); // MỚI: Lưu lý do người dùng chọn
  const [auditCustomReasons, setAuditCustomReasons] = useState<{
    [key: string]: string;
  }>({}); // Lý do tự nhập khi chọn "Khác..."
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

  const auditStatusLabel: Record<string, string> = {
    draft: "Nháp",
    pending_approval: "Chờ duyệt",
    approved: "Đã duyệt",
    rejected: "Từ chối",
  };
  const auditStatusClass = (st: string) =>
    st === "pending_approval"
      ? "text-amber-600"
      : st === "approved"
        ? "text-emerald-700"
        : st === "rejected"
          ? "text-rose-600"
          : "text-slate-700";

  const formatDate = (isoString: string) =>
    isoString ? new Date(isoString).toLocaleDateString("vi-VN") : "";

  // === MỞ MODAL NHẬP KHO CHO 1 PO ===
  const handleOpenReceivePO = (po: any) => {
    setSelectedPO(po);
    setReceiptNotes("");

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
          expiryDate: "",
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

  // === SUBMIT NHẬP KHO ===
  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;

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

      await fetchData();
      setShowReceiveModal(false);
      setSelectedPO(null);
      setActiveTab("batches");
      alert("Nhập kho thành công!");
    } catch (error: any) {
      alert("Lỗi khi nhập kho: " + error.message);
    } finally {
      setSavingReceipt(false);
    }
  };

  // === XỬ LÝ GỬI PHIẾU KIỂM KÊ ===
  const handleSubmitAuditForm = async () => {
    // 1. Kiểm tra xem các mặt hàng có chênh lệch đã được chọn lý do chưa
    const items: StockAuditItem[] = batches.slice(0, 6).map((b) => {
      const actual =
        auditItems[b.id] !== undefined ? auditItems[b.id] : b.quantity;
      const diff = actual - b.quantity;
      return {
        batchId: b.id,
        productId: b.productId,
        productName: products.find((p) => p.id === b.productId)?.name || "",
        systemQuantity: b.quantity,
        actualQuantity: actual,
        difference: diff,
        reason:
          diff === 0
            ? "Khớp"
            : auditReasons[b.id] === "Khác..."
              ? auditCustomReasons[b.id]?.trim()
                ? `Khác: ${auditCustomReasons[b.id].trim()}`
                : "Chưa rõ nguyên nhân"
              : auditReasons[b.id] || "Chưa rõ nguyên nhân",
      };
    });

    const hasMissingReason = items.some(
      (i) => i.difference !== 0 && i.reason === "Chưa rõ nguyên nhân",
    );
    if (hasMissingReason) {
      alert(
        'Vui lòng chọn lý do (và nhập nội dung nếu chọn "Khác...") cho các mặt hàng có số lượng chênh lệch!',
      );
      return;
    }

    const now = new Date();
    const auditCode = `KK-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${now.getTime().toString().slice(-6)}`;

    setAuditSubmitting(true);
    try {
      await stockAuditService.create({
        auditCode,
        items: items.map((i) => ({
          batchId: i.batchId as string,
          actualQuantity: i.actualQuantity,
          reason: i.difference !== 0 ? i.reason : undefined,
        })),
      });
      setAuditItems({});
      setAuditReasons({});
      setAuditCustomReasons({});
      setAuditSaved(true);
      setTimeout(() => setAuditSaved(false), 3000);
      await fetchAudits();
    } catch (error: any) {
      alert("Lỗi khi gửi phiếu kiểm kê: " + error.message);
    } finally {
      setAuditSubmitting(false);
    }
  };

  // === QUẢN LÝ DUYỆT / TỪ CHỐI PHIẾU (gọi API, không còn sửa state cục bộ) ===
  const handleReviewAudit = async (auditId: string, approved: boolean) => {
    try {
      await stockAuditService.review(auditId, approved);
      // Duyệt xong: tồn kho lô đã đổi trong DB -> tải lại lô + lịch sử phiếu
      await Promise.all([fetchData(), fetchAudits()]);
      setDetailAudit(null);
    } catch (error: any) {
      alert("Lỗi khi xử lý phiếu kiểm kê: " + error.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cảnh báo nguy cấp */}
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

      {/* NỘI DUNG TAB: ĐƠN CHỜ NHẬP KHO */}
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
                    <Package className="w-4 h-4" /> Bắt đầu Kiểm đếm & Nhập kho
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: THẺ KHO */}
      {activeTab === "batches" && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo số lô, tên sữa..."
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

      {/* TAB: CẢNH BÁO */}
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

      {/* TAB: KIỂM KÊ TỒN KHO - ĐÃ ĐƯỢC CHỈNH SỬA NGHIỆP VỤ */}
      {activeTab === "audit" && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Phiếu kiểm kê tồn kho cửa hàng
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Đối chiếu số lượng phần mềm hệ thống với số lượng thực tế kiểm
                đếm tại kệ
              </p>
            </div>
            {auditSaved && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã gửi phiếu kiểm kê,
                chờ quản lý duyệt!
              </span>
            )}
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
                  <th className="py-2.5 px-3 min-w-[200px]">
                    Lý do điều chỉnh (Kế toán)
                  </th>
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
                    <tr
                      key={b.id}
                      className={diff !== 0 ? "bg-amber-50/30" : ""}
                    >
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
                          className={`w-20 px-2 py-1 bg-white border ${diff !== 0 ? "border-amber-400 focus:border-amber-500" : "border-slate-300 focus:border-[#004885]"} rounded text-right font-bold text-xs outline-none`}
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
                        {/* THAY ĐỔI: Chuyển từ Text cứng sang Dropdown để người dùng chọn */}
                        {diff !== 0 ? (
                          <div className="space-y-1.5">
                            <select
                              value={auditReasons[b.id] || ""}
                              onChange={(e) =>
                                setAuditReasons({
                                  ...auditReasons,
                                  [b.id]: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 bg-white border border-amber-300 rounded text-xs outline-none focus:border-amber-500"
                            >
                              <option value="">
                                -- Chọn lý do bắt buộc --
                              </option>
                              {diff < 0 ? (
                                <>
                                  <option value="Hư hỏng / Rách vỡ bao bì">
                                    Hư hỏng / Rách vỡ bao bì
                                  </option>
                                  <option value="Hàng cận date / Hết hạn">
                                    Hàng cận date / Hết hạn
                                  </option>
                                  <option value="Thất thoát / Không tìm thấy">
                                    Thất thoát / Không tìm thấy
                                  </option>
                                  <option value="Sai số liệu sổ sách">
                                    Sai số liệu sổ sách
                                  </option>
                                  <option value="Khác...">Khác...</option>
                                </>
                              ) : (
                                <>
                                  <option value="Khách trả hàng chưa nhập">
                                    Khách trả hàng chưa nhập
                                  </option>
                                  <option value="Thừa khi nhận hàng">
                                    Thừa khi nhận hàng
                                  </option>
                                  <option value="Sai số liệu sổ sách">
                                    Sai số liệu sổ sách
                                  </option>
                                  <option value="Khác...">Khác...</option>
                                </>
                              )}
                            </select>
                            {auditReasons[b.id] === "Khác..." && (
                              <input
                                type="text"
                                autoFocus
                                maxLength={200}
                                value={auditCustomReasons[b.id] || ""}
                                onChange={(e) =>
                                  setAuditCustomReasons({
                                    ...auditCustomReasons,
                                    [b.id]: e.target.value,
                                  })
                                }
                                placeholder="Nhập lý do cụ thể..."
                                className="w-full px-2 py-1 bg-white border border-amber-300 rounded text-xs outline-none focus:border-amber-500"
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 px-2">Khớp</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Nút Gửi Kiểm Kê */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={handleSubmitAuditForm}
              disabled={auditSubmitting}
              className="disabled:opacity-60 px-5 py-2.5 bg-[#004885] hover:bg-[#00386b] text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              {auditSubmitting
                ? "Đang gửi..."
                : "Gửi phiếu kiểm kê chờ quản lý duyệt"}
            </button>
          </div>

          {/* Lịch sử các phiếu kiểm kê */}
          {audits.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-100 mt-4">
              <h4 className="font-bold text-sm text-slate-900">
                Lịch sử phiếu kiểm kê ({audits.length})
              </h4>
              {audits.map((a) => {
                const totalDiff = a.items.reduce(
                  (acc, i) => acc + i.difference,
                  0,
                );
                const statusLabel: Record<string, string> = {
                  draft: "Nháp",
                  pending_approval: "Chờ duyệt",
                  approved: "Đã duyệt",
                  rejected: "Từ chối",
                };
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#004885]">
                        {a.auditCode}
                      </span>
                      <span className="text-slate-500">
                        {" "}
                        • Ngày: {a.auditDate} • {a.items.length} mặt hàng •
                        Chênh lệch tổng:{" "}
                        {totalDiff > 0 ? `+${totalDiff}` : totalDiff}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-bold ${auditStatusClass(a.status)}`}
                      >
                        {statusLabel[a.status]}
                      </span>
                      <button
                        onClick={() => setDetailAudit(a)}
                        className="px-3 py-1.5 rounded-md bg-white border border-slate-300 text-[#004885] hover:bg-slate-100 font-bold transition-colors"
                      >
                        Chi tiết
                      </button>
                      {a.status === "pending_approval" &&
                        currentStaff.role === "manager" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReviewAudit(a.id, true)}
                              className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                            >
                              Duyệt
                            </button>
                            <button
                              onClick={() => handleReviewAudit(a.id, false)}
                              className="px-3 py-1.5 rounded-md bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold transition-colors"
                            >
                              Từ chối
                            </button>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CHI TIẾT PHIẾU KIỂM KÊ */}
      {detailAudit && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDetailAudit(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-[#004885]" />
                  Chi tiết phiếu kiểm kê{" "}
                  <span className="font-mono text-[#004885]">
                    {detailAudit.auditCode}
                  </span>
                </h3>
                <div className="text-xs text-slate-500 mt-2 space-y-1">
                  <p>
                    Ngày lập: <strong>{detailAudit.auditDate}</strong> • Trạng
                    thái:{" "}
                    <strong className={auditStatusClass(detailAudit.status)}>
                      {auditStatusLabel[detailAudit.status]}
                    </strong>
                  </p>
                  <p>
                    Người lập:{" "}
                    <strong>{detailAudit.performedByName || "—"}</strong> •
                    Người duyệt:{" "}
                    <strong>
                      {detailAudit.approvedByName || "Chưa duyệt"}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailAudit(null)}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-auto">
              {(() => {
                const diffCount = detailAudit.items.filter(
                  (i) => i.difference !== 0,
                ).length;
                const totalDiff = detailAudit.items.reduce(
                  (acc, i) => acc + i.difference,
                  0,
                );
                return (
                  <p className="text-xs text-slate-600 mb-3">
                    Tổng {detailAudit.items.length} dòng • {diffCount} dòng lệch
                    • Chênh lệch tổng:{" "}
                    <strong
                      className={
                        totalDiff === 0
                          ? "text-slate-500"
                          : totalDiff > 0
                            ? "text-emerald-700"
                            : "text-rose-600"
                      }
                    >
                      {totalDiff > 0 ? `+${totalDiff}` : totalDiff}
                    </strong>
                  </p>
                );
              })()}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">Mã Lô</th>
                    <th className="py-2.5 px-3">Sản phẩm</th>
                    <th className="py-2.5 px-3 text-right">SL Hệ thống</th>
                    <th className="py-2.5 px-3 text-right">SL Thực tế</th>
                    <th className="py-2.5 px-3 text-right">Chênh lệch</th>
                    <th className="py-2.5 px-3">Lý do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailAudit.items.map((i, idx) => (
                    <tr
                      key={`${i.batchId}-${idx}`}
                      className={i.difference !== 0 ? "bg-amber-50/30" : ""}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-[#004885]">
                        {i.batchCode || "—"}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {i.productName}
                        {i.unit && (
                          <span className="block font-normal text-slate-500">
                            {i.unit}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {i.systemQuantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        {i.actualQuantity}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold ${i.difference === 0 ? "text-slate-400" : i.difference > 0 ? "text-emerald-700" : "text-rose-600"}`}
                      >
                        {i.difference > 0 ? `+${i.difference}` : i.difference}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {i.difference === 0 ? "Khớp" : i.reason || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100">
              {detailAudit.status === "pending_approval" &&
                currentStaff.role === "manager" && (
                  <>
                    <button
                      onClick={() => handleReviewAudit(detailAudit.id, true)}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                    >
                      Duyệt
                    </button>
                    <button
                      onClick={() => handleReviewAudit(detailAudit.id, false)}
                      className="px-4 py-2 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold"
                    >
                      Từ chối
                    </button>
                  </>
                )}
              <button
                onClick={() => setDetailAudit(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Đóng
              </button>
            </div>
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
