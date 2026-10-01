import React, { useState } from "react";
import {
  Package,
  Tag,
  Layers,
  Plus,
  Edit2,
  Check,
  X,
  Search,
  DollarSign,
  Percent,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Product, Promotion, Category, PromotionScope } from "../../types";
import {
  CATEGORY_LABELS,
  CATEGORY_LIST,
  PROMOTION_SCOPE_LABELS,
  PROMOTION_STATUS_LABELS,
} from "../../lib/labels";

interface QuanLyHangHoaProps {
  products: Product[];
  promotions: Promotion[];
  onUpdateProductPrice: (
    productId: string,
    newSellingPrice: number,
    newCostPrice: number,
  ) => void;
  onAddProduct: (product: Product) => void;
  onAddPromotion: (promo: Promotion) => void;
}

export const QuanLyHangHoa: React.FC<QuanLyHangHoaProps> = ({
  products,
  promotions,
  onUpdateProductPrice,
  onAddProduct,
  onAddPromotion,
}) => {
  const [activeTab, setActiveTab] = useState<
    "products" | "categories" | "promotions"
  >("products");
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");

  // Price inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSellingPrice, setEditSellingPrice] = useState<number>(0);
  const [editCostPrice, setEditCostPrice] = useState<number>(0);

  // New Product Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProd, setNewProd] = useState<Partial<Product>>({
    code: `TH-MILK-${Math.floor(100 + Math.random() * 900)}`,
    name: "",
    category: "SUA_TUOI_TIET_TRUNG",
    unit: "Lốc 4 hộp",
    sellingPrice: 38000,
    costPrice: 30000,
    minStockLevel: 20,
    description: "",
    status: "active",
  });

  // New Promotion Modal
  const [showAddPromoModal, setShowAddPromoModal] = useState(false);
  const [newPromo, setNewPromo] = useState<Partial<Promotion>>({
    code: "THPROMO2026",
    name: "",
    scope: "order",
    discountType: "percentage",
    value: 10,
    maxDiscountAmount: undefined,
    startDate: "2026-09-20",
    endDate: "2026-10-20",
    minOrderValue: 150000,
    requiresCode: false,
    usageLimit: undefined,
    status: "scheduled",
  });

  const categories: Category[] = CATEGORY_LIST; // mã enum của DB

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCat === "all" || p.category === selectedCat;
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const startEditPrice = (p: Product) => {
    setEditingId(p.id);
    setEditSellingPrice(p.sellingPrice);
    setEditCostPrice(p.costPrice);
  };

  // Code mới gọi API PATCH /api/products/:id
  const saveEditPrice = async (productId: string) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/products/${productId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellingPrice: editSellingPrice,
            costPrice: editCostPrice,
          }),
        },
      );

      if (response.ok) {
        // Nếu Backend báo thành công, mới tiến hành cập nhật giao diện
        onUpdateProductPrice(productId, editSellingPrice, editCostPrice);
        setEditingId(null);
      } else {
        alert("Lỗi khi cập nhật giá trên hệ thống!");
      }
    } catch (error) {
      console.error("Lỗi cập nhật giá:", error);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.name) {
      alert("Vui lòng nhập tên sản phẩm!");
      return;
    }

    try {
      const response = await fetch("http://localhost:3001/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newProd.code || "TH-CUSTOM",
          name: newProd.name,
          category: newProd.category,
          unit: newProd.unit || "Hộp",
          sellingPrice: Number(newProd.sellingPrice),
          costPrice: Number(newProd.costPrice),
          minStockLevel: Number(newProd.minStockLevel) || 10,
          description: newProd.description || "",
          status: "active",
        }),
      });

      if (response.ok) {
        const savedProduct = await response.json();
        // Gọi hàm từ props để cập nhật lại danh sách trên UI (App.tsx)
        onAddProduct(savedProduct);
        setShowAddModal(false);
      } else {
        // Bắt lỗi Validation từ Backend (VD: Trùng mã Code/Barcode)
        const errorData = await response.json();
        alert(`Lỗi: ${errorData.message}`);
      }
    } catch (error) {
      console.error("Lỗi thêm sản phẩm:", error);
    }
  };

  const handleCreatePromotion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromo.code || !newPromo.name) {
      alert("Vui lòng nhập mã và tên chương trình khuyến mãi!");
      return;
    }
    if (promotions.some((p) => p.code === newPromo.code!.toUpperCase())) {
      alert("Mã khuyến mãi đã tồn tại!");
      return;
    }
    const value = Number(newPromo.value);
    if (!(value > 0)) {
      alert("Giá trị giảm phải lớn hơn 0!");
      return;
    }
    const startDate = newPromo.startDate || "2026-09-20";
    const endDate = newPromo.endDate || "2026-10-20";
    if (endDate <= startDate) {
      alert("Ngày kết thúc phải sau ngày bắt đầu!");
      return;
    }
    const scope = (newPromo.scope || "order") as PromotionScope;
    if (scope === "category" && !newPromo.applicableCategory) {
      alert("Vui lòng chọn nhóm hàng áp dụng!");
      return;
    }
    if (scope === "near_expiry" && !newPromo.nearExpiryDays) {
      alert("Vui lòng nhập số ngày còn hạn dùng để xả hàng!");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const promoToAdd: Promotion = {
      id: `promo-${Date.now()}`,
      code: newPromo.code.toUpperCase(),
      name: newPromo.name,
      description: newPromo.description,
      scope,
      discountType: newPromo.discountType as "percentage" | "fixed_amount",
      value,
      maxDiscountAmount:
        newPromo.discountType === "percentage" && newPromo.maxDiscountAmount
          ? Number(newPromo.maxDiscountAmount)
          : undefined,
      startDate,
      endDate,
      minOrderValue: Number(newPromo.minOrderValue) || 0,
      applicableCategory:
        scope === "category" ? newPromo.applicableCategory : undefined,
      nearExpiryDays:
        scope === "near_expiry" ? Number(newPromo.nearExpiryDays) : undefined,
      requiresCode: !!newPromo.requiresCode,
      usageLimit: newPromo.usageLimit ? Number(newPromo.usageLimit) : undefined,
      usedCount: 0,
      // Vòng đời: chưa tới ngày bắt đầu -> scheduled, đã tới ngày -> active
      status: startDate > today ? "scheduled" : "active",
    };
    onAddPromotion(promoToAdd);
    setShowAddPromoModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Sub Tabs: 2.1, 2.2, 2.3 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            id="tab-product-list"
            onClick={() => setActiveTab("products")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "products"
                ? "bg-[#004885] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>2.1 & 2.2 Danh mục & Cập nhật giá bán</span>
          </button>
          <button
            id="tab-categories"
            onClick={() => setActiveTab("categories")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "categories"
                ? "bg-[#004885] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2.1 Nhóm danh mục TH</span>
          </button>
          <button
            id="tab-promotions"
            onClick={() => setActiveTab("promotions")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "promotions"
                ? "bg-[#004885] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>2.3 Quản lý khuyến mãi ({promotions.length})</span>
          </button>
        </div>

        {activeTab === "products" && (
          <button
            id="btn-open-add-product"
            onClick={() => setShowAddModal(true)}
            className="bg-[#004885] hover:bg-[#00386b] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm sản phẩm mới</span>
          </button>
        )}

        {activeTab === "promotions" && (
          <button
            id="btn-open-add-promo"
            onClick={() => setShowAddPromoModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo CT khuyến mãi</span>
          </button>
        )}
      </div>

      {/* 2.1 & 2.2: Product Table with Price Update */}
      {activeTab === "products" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã SP, tên sữa..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:bg-white"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto">
              <button
                onClick={() => setSelectedCat("all")}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  selectedCat === "all"
                    ? "bg-[#004885] text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                Tất cả ({products.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCat(c)}
                  className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap ${
                    selectedCat === c
                      ? "bg-[#004885] text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Hình ảnh</th>
                  <th className="py-2.5 px-3">Mã SP</th>
                  <th className="py-2.5 px-3">Tên sản phẩm TH</th>
                  <th className="py-2.5 px-3">Danh mục</th>
                  <th className="py-2.5 px-3">Đơn vị</th>
                  <th className="py-2.5 px-3 text-right">Giá vốn (VNĐ)</th>
                  <th className="py-2.5 px-3 text-right">
                    Giá bán (VNĐ) (2.2)
                  </th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const isEditing = editingId === p.id;
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        {p.imageUrl ? (
                          <img
                            src={`http://localhost:3001${p.imageUrl}`}
                            alt={p.name}
                            className="w-12 h-12 object-contain rounded-md border border-slate-200 bg-white"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#004885]">
                        {p.code}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-xs">
                        {p.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                          {CATEGORY_LABELS[p.category] ?? p.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{p.unit}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500"></td>

                      {/* Cost Price */}
                      <td className="py-2.5 px-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editCostPrice}
                            onChange={(e) =>
                              setEditCostPrice(Number(e.target.value))
                            }
                            className="w-24 px-1.5 py-0.5 border border-sky-500 rounded text-right font-semibold bg-white"
                          />
                        ) : (
                          <span className="text-slate-500">
                            {p.costPrice.toLocaleString("vi-VN")} đ
                          </span>
                        )}
                      </td>

                      {/* Selling Price (2.2 Cập nhật giá bán) */}
                      <td className="py-2.5 px-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editSellingPrice}
                            onChange={(e) =>
                              setEditSellingPrice(Number(e.target.value))
                            }
                            className="w-28 px-1.5 py-0.5 border-2 border-[#004885] rounded text-right font-bold text-[#004885] bg-white"
                          />
                        ) : (
                          <span className="font-bold text-[#004885]">
                            {p.sellingPrice.toLocaleString("vi-VN")} đ
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-2.5 px-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => saveEditPrice(p.id)}
                              className="p-1 bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200"
                              title="Lưu giá mới"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                              title="Hủy"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditPrice(p)}
                            className="text-[#004885] hover:text-[#00386b] font-medium text-[11px] inline-flex items-center gap-1 bg-sky-50 px-2 py-1 rounded"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Đổi giá</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2.1: Categories breakdown */}
      {activeTab === "categories" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const count = products.filter((p) => p.category === cat).length;
            return (
              <div
                key={cat}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-sky-50 text-[#004885] flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {count} sản phẩm
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">
                  {CATEGORY_LABELS[cat]}
                </h4>
                <p className="text-xs text-slate-500">
                  Dòng sản phẩm nguyên chất tự nhiên tiêu chuẩn trang trại TH.
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* 2.3: Promotions List */}
      {activeTab === "promotions" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {promotions.map((promo) => (
            <div
              key={promo.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded">
                    {promo.code}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      promo.status === "active"
                        ? "text-emerald-700 bg-emerald-50"
                        : promo.status === "scheduled"
                          ? "text-sky-700 bg-sky-50"
                          : promo.status === "paused" ||
                              promo.status === "draft"
                            ? "text-amber-700 bg-amber-50"
                            : "text-slate-600 bg-slate-100"
                    }`}
                  >
                    {PROMOTION_STATUS_LABELS[promo.status]}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">
                  {promo.name}
                </h4>
                <p className="text-xs text-slate-600">
                  Ưu đãi:{" "}
                  <span className="font-bold text-rose-600">
                    {promo.discountType === "percentage"
                      ? `Giảm ${promo.value}%`
                      : `Giảm ${promo.value.toLocaleString("vi-VN")} đ`}
                  </span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Phạm vi: {PROMOTION_SCOPE_LABELS[promo.scope]}
                  {promo.scope === "category" && promo.applicableCategory
                    ? ` - ${CATEGORY_LABELS[promo.applicableCategory]}`
                    : ""}
                  {promo.scope === "near_expiry" && promo.nearExpiryDays
                    ? ` (còn <= ${promo.nearExpiryDays} ngày HSD)`
                    : ""}
                  {" • "}
                  {promo.requiresCode ? "Nhập mã khi bán" : "Tự động áp dụng"}
                </p>
                {promo.maxDiscountAmount ? (
                  <p className="text-[11px] text-slate-500">
                    Giảm tối đa:{" "}
                    {promo.maxDiscountAmount.toLocaleString("vi-VN")} đ
                  </p>
                ) : null}
                {promo.usageLimit ? (
                  <p className="text-[11px] text-slate-500">
                    Đã dùng: {promo.usedCount}/{promo.usageLimit} lượt
                  </p>
                ) : null}
                {promo.minOrderValue > 0 && (
                  <p className="text-[11px] text-slate-500">
                    Đơn tối thiểu: {promo.minOrderValue.toLocaleString("vi-VN")}{" "}
                    đ
                  </p>
                )}
              </div>

              <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  Thời hạn: {promo.startDate} đến {promo.endDate}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add New Product */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Thêm sản phẩm TH true milk mới
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Mã sản phẩm
                  </label>
                  <input
                    type="text"
                    value={newProd.code}
                    onChange={(e) =>
                      setNewProd({ ...newProd, code: e.target.value })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tên sản phẩm
                </label>
                <input
                  type="text"
                  placeholder="VD: Sữa tươi tiệt trùng TH true MILK Dâu 180ml"
                  value={newProd.name}
                  onChange={(e) =>
                    setNewProd({ ...newProd, name: e.target.value })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Danh mục
                  </label>
                  <select
                    value={newProd.category}
                    onChange={(e) =>
                      setNewProd({
                        ...newProd,
                        category: e.target.value as Category,
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Đơn vị tính
                  </label>
                  <input
                    type="text"
                    value={newProd.unit}
                    onChange={(e) =>
                      setNewProd({ ...newProd, unit: e.target.value })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="Lốc 4 hộp, Thùng, Hũ..."
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Giá vốn (VNĐ)
                  </label>
                  <input
                    type="number"
                    value={newProd.costPrice}
                    onChange={(e) =>
                      setNewProd({
                        ...newProd,
                        costPrice: Number(e.target.value),
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Giá bán niêm yết (VNĐ)
                  </label>
                  <input
                    type="number"
                    value={newProd.sellingPrice}
                    onChange={(e) =>
                      setNewProd({
                        ...newProd,
                        sellingPrice: Number(e.target.value),
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-[#004885]"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#004885] hover:bg-[#00386b] text-white rounded-lg font-bold shadow-xs"
                >
                  Lưu sản phẩm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Promotion */}
      {showAddPromoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Tạo chương trình khuyến mãi mới
              </h3>
              <button
                onClick={() => setShowAddPromoModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreatePromotion}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Mã khuyến mãi (Voucher Code)
                </label>
                <input
                  type="text"
                  value={newPromo.code}
                  onChange={(e) =>
                    setNewPromo({
                      ...newPromo,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono uppercase font-bold"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tên chương trình
                </label>
                <input
                  type="text"
                  placeholder="VD: Khuyến mãi mừng ngày Nhà giáo..."
                  value={newPromo.name}
                  onChange={(e) =>
                    setNewPromo({ ...newPromo, name: e.target.value })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Phạm vi áp dụng
                  </label>
                  <select
                    value={newPromo.scope}
                    onChange={(e) =>
                      setNewPromo({
                        ...newPromo,
                        scope: e.target.value as PromotionScope,
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    {(
                      Object.keys(PROMOTION_SCOPE_LABELS) as PromotionScope[]
                    ).map((sc) => (
                      <option key={sc} value={sc}>
                        {PROMOTION_SCOPE_LABELS[sc]}
                      </option>
                    ))}
                  </select>
                </div>
                {newPromo.scope === "category" && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Nhóm hàng
                    </label>
                    <select
                      value={newPromo.applicableCategory || ""}
                      onChange={(e) =>
                        setNewPromo({
                          ...newPromo,
                          applicableCategory: (e.target.value || undefined) as
                            | Category
                            | undefined,
                        })
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <option value="">-- Chọn nhóm hàng --</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {newPromo.scope === "near_expiry" && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Lô còn &lt;= (ngày HSD)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newPromo.nearExpiryDays || ""}
                      onChange={(e) =>
                        setNewPromo({
                          ...newPromo,
                          nearExpiryDays: Number(e.target.value),
                        })
                      }
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Loại giảm giá
                  </label>
                  <select
                    value={newPromo.discountType}
                    onChange={(e) =>
                      setNewPromo({
                        ...newPromo,
                        discountType: e.target.value as any,
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="percentage">Giảm theo %</option>
                    <option value="fixed_amount">Giảm số tiền cố định</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Giá trị giảm
                  </label>
                  <input
                    type="number"
                    value={newPromo.value}
                    onChange={(e) =>
                      setNewPromo({
                        ...newPromo,
                        value: Number(e.target.value),
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {newPromo.discountType === "percentage" && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Giảm tối đa (đ)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newPromo.maxDiscountAmount || ""}
                      onChange={(e) =>
                        setNewPromo({
                          ...newPromo,
                          maxDiscountAmount:
                            Number(e.target.value) || undefined,
                        })
                      }
                      placeholder="Để trống = không giới hạn"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                )}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tổng lượt dùng tối đa
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newPromo.usageLimit || ""}
                    onChange={(e) =>
                      setNewPromo({
                        ...newPromo,
                        usageLimit: Number(e.target.value) || undefined,
                      })
                    }
                    placeholder="Để trống = không giới hạn"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!newPromo.requiresCode}
                  onChange={(e) =>
                    setNewPromo({ ...newPromo, requiresCode: e.target.checked })
                  }
                  className="rounded text-[#004885]"
                />
                <span className="text-slate-700 font-medium">
                  Thu ngân phải nhập mã mới được giảm (không tự động áp dụng)
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPromoModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-xs"
                >
                  Tạo chương trình khuyến mãi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
