import React, { useState } from "react";
import {
  Truck,
  FileText,
  Plus,
  Search,
  Phone,
  MapPin,
  X,
  Edit,
  Trash2,
  CheckCircle2,
  Ban,
  Loader2,
} from "lucide-react";
import { Supplier, Product, PurchaseOrder } from "../../types";
import { SupplierInput } from "../../services/suppliers";
import { PurchaseOrderInput } from "../../services/purchaseOrders";
import { toNum, PURCHASE_STATUS_LABELS } from "../../lib/labels";

interface QuanLyNhaCungCapProps {
  suppliers: Supplier[];
  products: Product[];
  purchaseOrders: PurchaseOrder[];
  onAddSupplier: (data: SupplierInput) => Promise<void>;
  onUpdateSupplier: (id: string, data: Partial<SupplierInput>) => Promise<void>;
  onDeleteSupplier: (id: string) => Promise<void>;
  onCreatePurchaseOrder: (data: PurchaseOrderInput) => Promise<PurchaseOrder>;
  onUpdatePurchaseOrderStatus: (
    id: string,
    status: "received" | "cancelled",
  ) => Promise<PurchaseOrder>;
  onDeletePurchaseOrder: (id: string) => Promise<void>;
}

const EMPTY_SUPPLIER = {
  code: "",
  name: "",
  contactPerson: "",
  phone: "",
  address: "",
  categoryProvided: "Sữa tươi & Chế phẩm sữa TH",
};

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export const QuanLyNhaCungCap: React.FC<QuanLyNhaCungCapProps> = ({
  suppliers,
  products,
  purchaseOrders,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onCreatePurchaseOrder,
  onUpdatePurchaseOrderStatus,
  onDeletePurchaseOrder,
}) => {
  const [activeTab, setActiveTab] = useState<"suppliers" | "orders">(
    "suppliers",
  );
  const [search, setSearch] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Loading theo từng PO khi bấm Nhận hàng / Hủy
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  // Modals
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form thêm NCC
  const [newSup, setNewSup] = useState(EMPTY_SUPPLIER);

  // Form tạo PO
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [expectedDate, setExpectedDate] = useState("2026-09-25");
  const [poItems, setPoItems] = useState<
    { productId: string; quantity: number; unitPrice: number }[]
  >([{ productId: "", quantity: 50, unitPrice: 0 }]);
  const [poNotes, setPoNotes] = useState("");

  const currentSupplierId = selectedSupplierId || suppliers[0]?.id || "";
  const defaultProductId = products[0]?.id || "";

  // ===== Modal helpers =====
  const openAddModal = () => {
    setError(null);
    setShowAddSupplierModal(true);
  };
  const closeAddModal = () => {
    setError(null);
    setShowAddSupplierModal(false);
  };
  const openEditModal = (sup: Supplier) => {
    setError(null);
    setEditingSupplier(sup);
  };
  const closeEditModal = () => {
    setError(null);
    setEditingSupplier(null);
  };
  const openOrderModal = () => {
    setError(null);
    // Reset form mỗi lần mở
    setSelectedSupplierId(suppliers[0]?.id || "");
    setExpectedDate(new Date().toISOString().slice(0, 10));
    setPoItems([
      { productId: products[0]?.id || "", quantity: 50, unitPrice: 0 },
    ]);
    setPoNotes("");
    setShowCreateOrderModal(true);
  };
  const closeOrderModal = () => {
    setError(null);
    setShowCreateOrderModal(false);
  };

  // ===== Lọc NCC =====
  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(search.toLowerCase()),
  );

  // ===== Handlers NCC =====
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSup.name) return;

    setError(null);
    setSaving(true);
    try {
      await onAddSupplier({ ...newSup, status: "active" });
      setShowAddSupplierModal(false);
      setNewSup(EMPTY_SUPPLIER);
    } catch (err) {
      setError(getErrorMessage(err, "Không lưu được nhà cung cấp"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;

    setError(null);
    setSaving(true);
    try {
      const { name, contactPerson, phone, address, categoryProvided } =
        editingSupplier;
      await onUpdateSupplier(editingSupplier.id, {
        name,
        contactPerson,
        phone,
        address,
        categoryProvided,
      });
      setEditingSupplier(null);
    } catch (err) {
      setError(getErrorMessage(err, "Không cập nhật được nhà cung cấp"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa nhà cung cấp này?")) return;
    try {
      await onDeleteSupplier(id);
    } catch (err) {
      alert(getErrorMessage(err, "Không xóa được nhà cung cấp"));
    }
  };

  // ===== Handler tạo PO =====
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentSupplierId) {
      setError("Chưa có nhà cung cấp để lập đơn");
      return;
    }

    // Chỉ lấy những dòng hợp lệ
    const validItems = poItems
      .map((it) => ({
        productId: it.productId || defaultProductId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      }))
      .filter((it) => it.productId && it.quantity > 0 && it.unitPrice >= 0);

    if (validItems.length === 0) {
      setError("Đơn phải có ít nhất 1 sản phẩm với số lượng > 0");
      return;
    }

    // Kiểm tra trùng sản phẩm ngay trên frontend cho UX
    const productIds = validItems.map((i) => i.productId);
    if (new Set(productIds).size !== productIds.length) {
      setError("Không được chọn trùng sản phẩm trong cùng một đơn");
      return;
    }

    const payload: PurchaseOrderInput = {
      supplierId: currentSupplierId,
      expectedDate: new Date(expectedDate).toISOString(),
      notes: poNotes.trim() || undefined,
      items: validItems,
    };

    setError(null);
    setSaving(true);
    try {
      await onCreatePurchaseOrder(payload);
      setShowCreateOrderModal(false);
    } catch (err) {
      setError(getErrorMessage(err, "Không tạo được đơn đặt hàng"));
    } finally {
      setSaving(false);
    }
  };

  // ===== Handler đổi status PO =====
  const handleUpdateStatus = async (
    id: string,
    status: "received" | "cancelled",
  ) => {
    const msg =
      status === "received"
        ? "Xác nhận đã nhận hàng? Tồn kho sẽ được cập nhật."
        : "Hủy đơn nhập hàng này?";
    if (!window.confirm(msg)) return;

    setBusyOrderId(id);
    try {
      await onUpdatePurchaseOrderStatus(id, status);
    } catch (err) {
      alert(getErrorMessage(err, "Không cập nhật được trạng thái đơn"));
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!window.confirm("Xóa đơn nhập hàng này?")) return;
    setBusyOrderId(id);
    try {
      await onDeletePurchaseOrder(id);
    } catch (err) {
      alert(getErrorMessage(err, "Không xóa được đơn"));
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "suppliers"
                ? "bg-[#004885] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>6.1 Danh sách nhà cung cấp ({suppliers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "orders"
                ? "bg-[#004885] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>6.2 Đơn đặt hàng nhập kho ({purchaseOrders.length})</span>
          </button>
        </div>

        {activeTab === "suppliers" ? (
          <button
            onClick={openAddModal}
            className="bg-[#004885] hover:bg-[#00386b] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm nhà cung cấp mới</span>
          </button>
        ) : (
          <button
            onClick={openOrderModal}
            disabled={suppliers.length === 0 || products.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Lập đơn đặt hàng (PO) mới</span>
          </button>
        )}
      </div>

      {/* 6.1: Suppliers */}
      {activeTab === "suppliers" && (
        <div className="space-y-4">
          <div className="relative w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên nhà cung cấp, mã..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map((sup) => (
              <div
                key={sup.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs bg-sky-50 text-[#004885] px-2 py-0.5 rounded">
                      {sup.code}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Đối tác chính thức
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(sup)}
                      className="p-1 text-slate-400 hover:text-blue-600 bg-slate-50 rounded"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(sup.id)}
                      className="p-1 text-slate-400 hover:text-red-600 bg-slate-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 leading-snug">
                    {sup.name}
                  </h4>

                  <div className="space-y-1 text-xs text-slate-600 pt-1">
                    <p className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800">
                        Liên hệ:
                      </span>{" "}
                      {sup.contactPerson}
                    </p>
                    <p className="flex items-center gap-1.5 text-slate-500">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{sup.phone}</span>
                    </p>
                    <p className="flex items-start gap-1.5 text-slate-500 text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{sup.address}</span>
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-2.5 text-[11px] text-[#004885] font-medium bg-sky-50/50 p-2 rounded">
                  Cung cấp: {sup.categoryProvided}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6.2: Purchase Orders */}
      {activeTab === "orders" && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                6.2 Danh sách đơn đặt hàng nhập kho (PO)
              </h3>
              <p className="text-xs text-slate-500">
                Theo dõi tiến độ giao hàng từ trang trại TH và các nhà cung cấp
                bao bì nguyên liệu
              </p>
            </div>
          </div>

          {purchaseOrders.length === 0 && (
            <p className="text-xs text-slate-500 italic py-6 text-center">
              Chưa có đơn nhập hàng nào. Bấm "Lập đơn đặt hàng (PO) mới" để bắt
              đầu.
            </p>
          )}

          <div className="space-y-3">
            {purchaseOrders.map((po) => {
              const isPending = po.status === "pending";
              const isBusy = busyOrderId === po.id;

              return (
                <div
                  key={po.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#004885]">
                        {po.orderCode}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="font-semibold text-slate-900">
                        {po.suppliers?.name ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">
                        Dự kiến nhận:{" "}
                        <strong className="text-slate-800">
                          {po.expectedDate?.slice(0, 10) ?? "—"}
                        </strong>
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          po.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : po.status === "received"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {PURCHASE_STATUS_LABELS[po.status]}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {(po.purchase_order_items ?? []).map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between text-slate-700"
                      >
                        <span>
                          • {item.products?.name ?? "—"} (Số lượng:{" "}
                          <strong>{item.quantity}</strong>)
                        </span>
                        <span className="font-semibold">
                          {toNum(item.subtotal).toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-200 pt-2 font-bold text-xs">
                    <span className="text-slate-600">
                      Tổng giá trị đơn hàng:
                    </span>
                    <span className="text-sm text-[#004885]">
                      {toNum(po.totalAmount).toLocaleString("vi-VN")} đ
                    </span>
                  </div>

                  {po.notes && (
                    <p className="text-[11px] text-slate-500 italic border-l-2 border-slate-200 pl-2">
                      Ghi chú: {po.notes}
                    </p>
                  )}

                  {isPending && (
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        onClick={() => handleUpdateStatus(po.id, "cancelled")}
                        disabled={isBusy}
                        className="flex items-center gap-1 px-3 py-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg font-bold disabled:opacity-60"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Ban className="w-3.5 h-3.5" />
                        )}
                        <span>Hủy đơn</span>
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(po.id, "received")}
                        disabled={isBusy}
                        className="flex items-center gap-1 px-3 py-1.5 text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold disabled:opacity-60"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Nhận hàng</span>
                      </button>
                      <button
                        onClick={() => handleDeleteOrder(po.id)}
                        disabled={isBusy}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg font-bold disabled:opacity-60"
                        title="Xóa đơn"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Add Supplier */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Thêm nhà cung cấp mới
              </h3>
              <button
                onClick={closeAddModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Mã nhà cung cấp
                </label>
                <input
                  type="text"
                  placeholder="VD: NCC001"
                  value={newSup.code}
                  onChange={(e) =>
                    setNewSup({ ...newSup, code: e.target.value })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tên đơn vị cung cấp
                </label>
                <input
                  type="text"
                  placeholder="VD: Trang trại bò sữa TH số 3 Nghĩa Đàn"
                  value={newSup.name}
                  onChange={(e) =>
                    setNewSup({ ...newSup, name: e.target.value })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Người đại diện
                  </label>
                  <input
                    type="text"
                    value={newSup.contactPerson}
                    onChange={(e) =>
                      setNewSup({ ...newSup, contactPerson: e.target.value })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={newSup.phone}
                    onChange={(e) =>
                      setNewSup({ ...newSup, phone: e.target.value })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={newSup.address}
                  onChange={(e) =>
                    setNewSup({ ...newSup, address: e.target.value })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              {error && <p className="text-red-600 font-medium">{error}</p>}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#004885] hover:bg-[#00386b] text-white rounded-lg font-bold shadow-xs disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu nhà cung cấp"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Supplier */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Sửa thông tin nhà cung cấp
              </h3>
              <button
                onClick={closeEditModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tên đơn vị cung cấp
                </label>
                <input
                  type="text"
                  value={editingSupplier.name}
                  onChange={(e) =>
                    setEditingSupplier({
                      ...editingSupplier,
                      name: e.target.value,
                    })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Người đại diện
                  </label>
                  <input
                    type="text"
                    value={editingSupplier.contactPerson}
                    onChange={(e) =>
                      setEditingSupplier({
                        ...editingSupplier,
                        contactPerson: e.target.value,
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={editingSupplier.phone}
                    onChange={(e) =>
                      setEditingSupplier({
                        ...editingSupplier,
                        phone: e.target.value,
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={editingSupplier.address}
                  onChange={(e) =>
                    setEditingSupplier({
                      ...editingSupplier,
                      address: e.target.value,
                    })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              {error && <p className="text-red-600 font-medium">{error}</p>}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-xs disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Cập nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: 6.2 Lập đơn đặt hàng */}
      {showCreateOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                6.2 Lập đơn đặt hàng nhập kho (PO)
              </h3>
              <button
                onClick={closeOrderModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nhà cung cấp tiếp nhận
                </label>
                <select
                  value={currentSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Ngày dự kiến giao hàng
                </label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">
                    Sản phẩm, số lượng & đơn giá nhập
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setPoItems((prev) => [
                        ...prev,
                        {
                          productId: defaultProductId,
                          quantity: 10,
                          unitPrice: 0,
                        },
                      ])
                    }
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    <Plus className="w-3 h-3" />
                    Thêm dòng
                  </button>
                </div>

                <div className="space-y-2">
                  {poItems.map((item, idx) => {
                    const lineTotal = item.quantity * item.unitPrice;
                    return (
                      <div
                        key={idx}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                      >
                        {/* Hàng 1: chọn sản phẩm + nút xóa */}
                        <div className="flex gap-2 items-center">
                          <select
                            value={item.productId || defaultProductId}
                            onChange={(e) => {
                              const newProductId = e.target.value;
                              const prod = products.find(
                                (p) => p.id === newProductId,
                              );
                              const updated = [...poItems];
                              updated[idx] = {
                                ...updated[idx],
                                productId: newProductId,
                                unitPrice: prod?.costPrice ?? 0,
                              };
                              setPoItems(updated);
                            }}
                            className="flex-1 min-w-0 p-2 bg-white border border-slate-200 rounded-lg text-xs"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.unit})
                              </option>
                            ))}
                          </select>

                          {poItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setPoItems((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                )
                              }
                              className="p-2 text-slate-400 hover:text-red-600 shrink-0"
                              title="Xóa dòng"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Hàng 2: số lượng + đơn giá + thành tiền */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                              Số lượng
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const updated = [...poItems];
                                updated[idx] = {
                                  ...updated[idx],
                                  quantity: Number(e.target.value),
                                };
                                setPoItems(updated);
                              }}
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-right font-bold text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                              Đơn giá (đ)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={item.unitPrice}
                              onChange={(e) => {
                                const updated = [...poItems];
                                updated[idx] = {
                                  ...updated[idx],
                                  unitPrice: Number(e.target.value),
                                };
                                setPoItems(updated);
                              }}
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-right font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                              Thành tiền
                            </label>
                            <div className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-right font-bold text-xs text-[#004885]">
                              {lineTotal.toLocaleString("vi-VN")}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-slate-500 mt-1">
                  Tổng tạm tính:{" "}
                  <strong className="text-[#004885]">
                    {poItems
                      .reduce((sum, it) => sum + it.quantity * it.unitPrice, 0)
                      .toLocaleString("vi-VN")}{" "}
                    đ
                  </strong>
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Ghi chú đơn hàng
                </label>
                <textarea
                  rows={2}
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Ghi chú yêu cầu nhiệt độ bảo quản lạnh, xe chuyên dụng..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              {error && <p className="text-red-600 font-medium">{error}</p>}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeOrderModal}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-xs disabled:opacity-60"
                >
                  {saving ? "Đang gửi..." : "Gửi đơn đặt hàng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
