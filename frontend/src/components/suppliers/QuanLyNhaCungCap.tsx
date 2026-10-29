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
  Eye,
} from "lucide-react";
import { Product } from "../../types";
import { useSuppliers } from "../../hooks/useSuppliers";
import { Supplier } from "../../services/suppliers";
import { usePurchaseOrders } from "../../hooks/usePurchaseOrders";
interface QuanLyNhaCungCapProps {
  products: Product[];
}

const EMPTY_SUPPLIER = {
  code: "",
  name: "",
  contactPerson: "",
  phone: "",
  address: "",
  categoryProvided: "",
};

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

// Hàm từ điển xử lý trạng thái Đơn đặt hàng
const getStatusDisplay = (status: string) => {
  switch (status) {
    case "received":
      return {
        text: "Đã nhập kho",
        className: "bg-emerald-100 text-emerald-800",
      };
    case "cancelled":
      return {
        text: "Đã hủy",
        className: "bg-rose-100 text-rose-800 line-through",
      };
    case "pending":
    default:
      return {
        text: "Chờ tiếp nhận kho",
        className: "bg-amber-100 text-amber-800",
      };
  }
};

export const QuanLyNhaCungCap: React.FC<QuanLyNhaCungCapProps> = ({
  products,
}) => {
  const {
    suppliers,
    isLoading,
    error: hookError,
    addSupplier,
    updateSupplier,
    deleteSupplier,
  } = useSuppliers();

  const {
    purchaseOrders,
    error: poError,
    addPurchaseOrder,
  } = usePurchaseOrders();

  const [activeTab, setActiveTab] = useState<"suppliers" | "orders">(
    "suppliers",
  );
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modals
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // MỚI: State lưu trữ đơn hàng đang được xem chi tiết
  const [selectedPODetails, setSelectedPODetails] = useState<any | null>(null);

  const [newSup, setNewSup] = useState(EMPTY_SUPPLIER);

  const getExpectedDeliveryDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  };

  // New Purchase Order State
  const defaultProductId = products[0]?.id || "";
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [expectedDate, setExpectedDate] = useState(getExpectedDeliveryDate);
  const [poItems, setPoItems] = useState<
    { productId: string; quantity: number }[]
  >([{ productId: defaultProductId, quantity: 50 }]);
  const [poNotes, setPoNotes] = useState("");

  const currentSupplierId = selectedSupplierId || suppliers[0]?.id || "";

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
    setExpectedDate(getExpectedDeliveryDate());
    setPoItems([{ productId: defaultProductId, quantity: 50 }]);
    setShowCreateOrderModal(true);
  };
  const closeOrderModal = () => {
    setError(null);
    setShowCreateOrderModal(false);
  };

  const handleAddPoItem = () => {
    setPoItems([...poItems, { productId: defaultProductId, quantity: 1 }]);
  };

  const handleRemovePoItem = (index: number) => {
    if (poItems.length > 1) {
      const updated = [...poItems];
      updated.splice(index, 1);
      setPoItems(updated);
    } else {
      setError("Đơn đặt hàng phải có ít nhất 1 sản phẩm!");
    }
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSup.name) return;
    setError(null);
    setSaving(true);
    const success = await addSupplier({ ...newSup, status: "active" });
    setSaving(false);
    if (success) {
      setShowAddSupplierModal(false);
      setNewSup(EMPTY_SUPPLIER);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;
    setError(null);
    setSaving(true);
    const { name, contactPerson, phone, address, categoryProvided } =
      editingSupplier;
    const success = await updateSupplier(editingSupplier.id, {
      name,
      contactPerson,
      phone,
      address,
      categoryProvided,
    });
    setSaving(false);
    if (success) setEditingSupplier(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa nhà cung cấp này?")) return;
    await deleteSupplier(id);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === currentSupplierId);
    if (!sup) {
      setError("Chưa có nhà cung cấp để lập đơn");
      return;
    }

    const validItems = poItems.filter((i) => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      setError("Vui lòng chọn ít nhất 1 sản phẩm hợp lệ!");
      return;
    }

    const items = validItems.map((item) => {
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

    const payload = {
      supplierId: sup.id,
      expectedDate,
      notes: poNotes,
      items: items.map(({ productId, quantity, unitPrice }) => ({
        productId,
        quantity,
        unitPrice,
      })),
    };

    setError(null);
    setSaving(true);
    try {
      const ok = await addPurchaseOrder(payload);
      if (ok) {
        setShowCreateOrderModal(false);
        setPoItems([{ productId: defaultProductId, quantity: 50 }]);
        setPoNotes("");
      }
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
            <Plus className="w-4 h-4" /> <span>Thêm nhà cung cấp mới</span>
          </button>
        ) : (
          <button
            onClick={openOrderModal}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> <span>Lập đơn đặt hàng (PO) mới</span>
          </button>
        )}
      </div>

      {hookError && !showAddSupplierModal && !editingSupplier && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 font-medium">
          {hookError}
        </div>
      )}

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
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white"
            />
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-500 font-medium">
              Đang tải dữ liệu nhà cung cấp...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map((sup) => (
                <div
                  key={sup.id}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs bg-sky-50 text-[#004885] px-2 py-0.5 rounded">
                        {sup.code}
                      </span>
                      <span
                        className={
                          sup.status === "active"
                            ? "text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded"
                            : "text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded"
                        }
                      >
                        {sup.status === "active"
                          ? "Hoạt động"
                          : "Ngừng cung cấp"}
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
          )}
        </div>
      )}

      {/* 6.2: Purchase Orders List */}
      {activeTab === "orders" && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
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
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-2">
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
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusDisplay(po.status).className}`}
                      >
                        {getStatusDisplay(po.status).text}
                      </span>
                    </div>
                  </div>

                  {/* Chỉ hiển thị tối đa 2 sản phẩm ở thẻ ngoài */}
                  <div className="space-y-1 text-slate-600">
                    {po.items.slice(0, 2).map((item: any, idx: number) => (
                      <div key={idx} className="truncate">
                        • {item.productName} (SL: {item.quantity})
                      </div>
                    ))}
                    {po.items.length > 2 && (
                      <div className="text-[11px] italic text-slate-400 mt-1">
                        ... và {po.items.length - 2} mặt hàng khác
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-slate-200 pt-3 mt-3">
                  <button
                    onClick={() => setSelectedPODetails(po)}
                    className="text-[#004885] hover:text-[#00386b] text-xs font-bold flex items-center gap-1 bg-sky-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> Xem chi tiết đơn
                  </button>
                  <div className="text-right">
                    <span className="text-slate-500 text-xs mr-2">
                      Tổng giá trị:
                    </span>
                    <span className="text-sm font-bold text-[#004885]">
                      {po.totalAmount.toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: XEM CHI TIẾT ĐƠN ĐẶT HÀNG */}
      {selectedPODetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#004885]" />
                  Chi tiết Đơn đặt hàng {selectedPODetails.orderCode}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Nhà cung cấp:{" "}
                  <strong className="text-slate-800">
                    {selectedPODetails.supplierName}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedPODetails(null)}
                className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto py-4 flex-1 text-xs">
              <div className="flex items-center justify-between mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="block text-slate-500 mb-0.5">
                    Trạng thái:
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${getStatusDisplay(selectedPODetails.status).className}`}
                  >
                    {getStatusDisplay(selectedPODetails.status).text}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-slate-500 mb-0.5">
                    Ngày giao hàng dự kiến:
                  </span>
                  <span className="font-bold text-slate-800 text-sm">
                    {selectedPODetails.expectedDate}
                  </span>
                </div>
              </div>

              <h4 className="font-bold text-slate-800 mb-2">
                Danh sách mặt hàng
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="px-3 py-2.5">Sản phẩm</th>
                      <th className="px-3 py-2.5 text-right">Đơn giá</th>
                      <th className="px-3 py-2.5 text-right">Số lượng</th>
                      <th className="px-3 py-2.5 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPODetails.items.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-medium text-slate-800">
                          {item.productName}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-600">
                          {item.unitPrice.toLocaleString("vi-VN")} đ
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-[#004885]">
                          {item.subtotal.toLocaleString("vi-VN")} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-sky-50/50 border-t border-slate-200">
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-3 text-right font-bold text-slate-700"
                      >
                        TỔNG CỘNG:
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-lg text-[#004885]">
                        {selectedPODetails.totalAmount.toLocaleString("vi-VN")}{" "}
                        đ
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedPODetails.notes && (
                <div className="mt-4 p-3 bg-amber-50/50 border border-amber-100 rounded-lg">
                  <span className="font-bold text-amber-800 block mb-1 text-[11px]">
                    Ghi chú đơn hàng:
                  </span>
                  <p className="text-slate-700 italic">
                    {selectedPODetails.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedPODetails(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Supplier */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
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
                  Mặt hàng cung cấp
                </label>
                <input
                  type="text"
                  placeholder="VD: Sữa tươi, Bao bì, Thiết bị..."
                  value={newSup.categoryProvided}
                  onChange={(e) =>
                    setNewSup({ ...newSup, categoryProvided: e.target.value })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
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
              {(error || poError) && (
                <p className="text-red-600 font-medium">{error || poError}</p>
              )}
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
                  className="px-4 py-2 bg-[#004885] hover:bg-[#00386b] text-white rounded-lg font-bold shadow-sm disabled:opacity-60"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
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
                  Mặt hàng cung cấp
                </label>
                <input
                  type="text"
                  value={editingSupplier.categoryProvided}
                  onChange={(e) =>
                    setEditingSupplier({
                      ...editingSupplier,
                      categoryProvided: e.target.value,
                    })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
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
              {(error || hookError) && (
                <p className="text-red-600 font-medium">{error || hookError}</p>
              )}
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
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-sm disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Cập nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Lập đơn đặt hàng ĐÃ ĐƯỢC NÂNG CẤP */}
      {showCreateOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
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
            <form
              id="create-po-form"
              onSubmit={handleCreateOrder}
              className="space-y-3 text-xs overflow-y-auto pr-2"
            >
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
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-700">
                    Sản phẩm & Số lượng đặt
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPoItem}
                    className="text-[10px] bg-sky-100 text-[#004885] px-2 py-1 rounded font-bold hover:bg-sky-200 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Thêm dòng
                  </button>
                </div>
                <div className="space-y-2">
                  {poItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
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
                      {poItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePoItem(idx)}
                          className="p-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          title="Xóa dòng"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1 mt-2">
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
            </form>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
              <button
                type="button"
                onClick={closeOrderModal}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs"
              >
                Hủy
              </button>
              <button
                type="submit"
                form="create-po-form"
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-sm disabled:opacity-60 text-xs"
              >
                {saving ? "Đang gửi..." : "Gửi đơn đặt hàng"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
