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
} from "lucide-react";
import { Supplier, PurchaseOrder, Product } from "../../types";
import { SupplierInput } from "../../services/suppliers";
import { fetchApi } from "../../lib/api";

interface QuanLyNhaCungCapProps {
  suppliers: Supplier[];
  products: Product[];
  purchaseOrders: PurchaseOrder[];
  // Các hàm này gọi API rồi mới cập nhật state; nếu API lỗi sẽ ném lỗi (throw)
  onAddSupplier: (data: SupplierInput) => Promise<void>;
  onUpdateSupplier: (id: string, data: Partial<SupplierInput>) => Promise<void>;
  onDeleteSupplier: (id: string) => Promise<void>;
  onCreatePurchaseOrder: (po: PurchaseOrder) => void;
}

// Giá trị ban đầu của form thêm NCC (mã để trống, người dùng tự nhập)
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
}) => {
  const [activeTab, setActiveTab] = useState<"suppliers" | "orders">(
    "suppliers",
  );
  const [search, setSearch] = useState("");

  // Thông báo lỗi dùng chung cho các modal (mỗi lúc chỉ mở một modal)
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modals
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // New Supplier State (6.1)
  const [newSup, setNewSup] = useState(EMPTY_SUPPLIER);

  // New Purchase Order State (6.2)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [expectedDate, setExpectedDate] = useState("2026-09-25");
  const [poItems, setPoItems] = useState<
    { productId: string; quantity: number }[]
  >([{ productId: "", quantity: 50 }]);
  const [poNotes, setPoNotes] = useState("");

  // NCC và sản phẩm tải bất đồng bộ từ API nên lúc khởi tạo state có thể còn rỗng;
  // dùng giá trị dự phòng là phần tử đầu tiên khi người dùng chưa chọn
  const currentSupplierId = selectedSupplierId || suppliers[0]?.id || "";
  const defaultProductId = products[0]?.id || "";

  // ===== Mở / đóng modal (luôn xóa lỗi cũ) =====
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
    setShowCreateOrderModal(true);
  };
  const closeOrderModal = () => {
    setError(null);
    setShowCreateOrderModal(false);
  };

  // ===== Lọc danh sách =====
  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(search.toLowerCase()),
  );

  // ===== Handlers nhà cung cấp =====
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSup.name) return;

    setError(null);
    setSaving(true);
    try {
      await onAddSupplier({ ...newSup, status: "active" });
      setShowAddSupplierModal(false);
      setNewSup(EMPTY_SUPPLIER); // reset form cho lần thêm sau
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

  // ===== Handler đơn đặt hàng (PO) =====
  // TODO: chuyển phần gọi API sang services/purchaseOrders.ts khi làm module PO
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === currentSupplierId);
    if (!sup) {
      setError("Chưa có nhà cung cấp để lập đơn");
      return;
    }

    const items = poItems.map((item) => {
      const productId = item.productId || defaultProductId;
      const prod = products.find((p) => p.id === productId);
      const unitPrice = prod?.costPrice || 30000;
      return {
        productId,
        productName: prod?.name || "Sản phẩm",
        quantity: item.quantity,
        unitPrice,
        subtotal: unitPrice * item.quantity,
      };
    });

    const totalAmount = items.reduce((acc, i) => acc + i.subtotal, 0);

    const payload = {
      // Backend sẽ tự sinh orderCode và ID
      supplierId: sup.id,
      supplierName: sup.name,
      expectedDate,
      items,
      totalAmount,
      status: "pending",
      notes: poNotes,
    };

    setError(null);
    setSaving(true);
    try {
      const savedPO = await fetchApi<PurchaseOrder>("/api/purchase-orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onCreatePurchaseOrder(savedPO);
      setShowCreateOrderModal(false);
    } catch (err) {
      setError(getErrorMessage(err, "Không tạo được đơn đặt hàng"));
    } finally {
      setSaving(false);
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
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Lập đơn đặt hàng (PO) mới</span>
          </button>
        )}
      </div>

      {/* 6.1: Suppliers Cards */}
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

      {/* 6.2: Purchase Orders List */}
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

          <div className="space-y-3">
            {purchaseOrders.map((po) => (
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
                      {po.supplierName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">
                      Dự kiến nhận:{" "}
                      <strong className="text-slate-800">
                        {po.expectedDate}
                      </strong>
                    </span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Chờ tiếp nhận kho
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  {po.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between text-slate-700"
                    >
                      <span>
                        • {item.productName} (Số lượng:{" "}
                        <strong>{item.quantity}</strong>)
                      </span>
                      <span className="font-semibold">
                        {item.subtotal.toLocaleString("vi-VN")} đ
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center border-t border-slate-200 pt-2 font-bold text-xs">
                  <span className="text-slate-600">Tổng giá trị đơn hàng:</span>
                  <span className="text-sm text-[#004885]">
                    {po.totalAmount.toLocaleString("vi-VN")} đ
                  </span>
                </div>
              </div>
            ))}
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

              {/* Items in PO */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Sản phẩm & Số lượng đặt
                </label>
                <div className="space-y-2">
                  {poItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <select
                        value={item.productId || defaultProductId}
                        onChange={(e) => {
                          const updated = [...poItems];
                          updated[idx] = {
                            ...updated[idx],
                            productId: e.target.value,
                          };
                          setPoItems(updated);
                        }}
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit})
                          </option>
                        ))}
                      </select>
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
                        className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-bold"
                        placeholder="Số lượng"
                      />
                    </div>
                  ))}
                </div>
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
