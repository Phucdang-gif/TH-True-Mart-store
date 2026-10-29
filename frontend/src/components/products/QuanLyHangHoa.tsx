import React, { useState } from "react";
import { assetUrl } from "../../lib/api";
import {
  Package,
  Tag,
  Layers,
  Plus,
  Edit2,
  Edit,
  Check,
  X,
  Search,
  Calendar,
  Trash2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Product, Promotion, Category, PromotionScope } from "../../types";
import type {
  CreatePromotionInput,
  PromotionAction,
} from "../../services/promotions";
import { ProductInput } from "../../services/products";
import {
  PROMOTION_SCOPE_LABELS,
  PROMOTION_STATUS_LABELS,
} from "../../lib/labels";
import { useCategories } from "../../hooks/useCategories";
import { CategoryItem } from "../../services/categories";

interface QuanLyHangHoaProps {
  products: Product[];
  promotions: Promotion[];
  // Gọi API rồi mới cập nhật state; nếu API lỗi sẽ ném lỗi (throw)
  onUpdateProduct?: (
    productId: string,
    data: Partial<ProductInput>,
  ) => Promise<any>;
  onUpdateProductPrice: (
    productId: string,
    newSellingPrice: number,
    newCostPrice: number,
  ) => Promise<void>;
  onAddProduct: (data: ProductInput) => Promise<void>;
  // Gọi API; ném lỗi (throw) nếu server từ chối
  onCreatePromotion: (input: CreatePromotionInput) => Promise<void>;
  onChangePromotionStatus: (
    id: string,
    action: PromotionAction,
  ) => Promise<void>;
}

// Giá trị ban đầu của form thêm sản phẩm
const EMPTY_PRODUCT: Partial<Product> = {
  code: "",
  name: "",
  category: "SUA_TUOI_TIET_TRUNG",
  unit: "Lốc 4 hộp",
  sellingPrice: 38000,
  costPrice: 30000,
  minStockLevel: 20,
  description: "",
  status: "active",
};

export const QuanLyHangHoa: React.FC<QuanLyHangHoaProps> = ({
  products,
  promotions,
  onUpdateProduct,
  onUpdateProductPrice,
  onAddProduct,
  onCreatePromotion,
  onChangePromotionStatus,
}) => {
  const [activeTab, setActiveTab] = useState<
    "products" | "categories" | "promotions"
  >("products");
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");

  // === API CATEGORIES HOOK ===
  const {
    categories,
    isLoading: loadingCategories,
    reloadCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategories();

  // Category Modal & Editing State
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatCode, setNewCatCode] = useState("");
  const [newCatName, setNewCatName] = useState("");
  // Product Full Editing Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editProdForm, setEditProdForm] = useState<Partial<ProductInput>>({});
  const [editProdSaving, setEditProdSaving] = useState(false);
  const [editProdError, setEditProdError] = useState<string | null>(null);

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setEditProdForm({
      code: prod.code,
      name: prod.name,
      categoryId: prod.categoryId,
      category: prod.category,
      unit: prod.unit,
      sellingPrice: prod.sellingPrice,
      costPrice: prod.costPrice,
      minStockLevel: prod.minStockLevel,
      description: prod.description || '',
      imageUrl: prod.imageUrl || '',
      status: prod.status,
    });
    setEditProdError(null);
  };

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      setEditProdSaving(true);
      setEditProdError(null);
      if (onUpdateProduct) {
        await onUpdateProduct(editingProduct.id, editProdForm);
      } else {
        await onUpdateProductPrice(
          editingProduct.id,
          Number(editProdForm.sellingPrice ?? editingProduct.sellingPrice),
          Number(editProdForm.costPrice ?? editingProduct.costPrice),
        );
      }
      setEditingProduct(null);
    } catch (err: any) {
      setEditProdError(err.message || 'Không thể cập nhật sản phẩm');
    } finally {
      setEditProdSaving(false);
    }
  };

  const [editingCat, setEditingCat] = useState<CategoryItem | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatStatus, setEditCatStatus] = useState("active");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // Helper lấy tên hiển thị của danh mục động từ API
  const getCategoryName = (codeOrId?: string) => {
    if (!codeOrId) return "Chưa phân loại";
    const found = categories.find(
      (c) => c.code === codeOrId || c.id === codeOrId,
    );
    return found ? found.name : codeOrId;
  };

  // Price inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSellingPrice, setEditSellingPrice] = useState<number>(0);
  const [editCostPrice, setEditCostPrice] = useState<number>(0);

  // New Product Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProd, setNewProd] = useState<Partial<Product>>(EMPTY_PRODUCT);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openAddModal = () => {
    setError(null);
    setShowAddModal(true);
  };
  const closeAddModal = () => {
    setError(null);
    setShowAddModal(false);
  };

  // New Promotion Modal
  const [showAddPromoModal, setShowAddPromoModal] = useState(false);
  const isoDay = (offsetDays: number) =>
    new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
  const EMPTY_PROMO: Partial<Promotion> = {
    code: "",
    name: "",
    scope: "order",
    discountType: "percentage",
    value: 10,
    maxDiscountAmount: undefined,
    startDate: isoDay(0),
    endDate: isoDay(30),
    minOrderValue: 0,
    requiresCode: false,
    usageLimit: undefined,
  };
  const [newPromo, setNewPromo] = useState<Partial<Promotion>>(EMPTY_PROMO);
  const [promoProductIds, setPromoProductIds] = useState<string[]>([]);
  const [promoActivateNow, setPromoActivateNow] = useState(true);
  const [promoSaving, setPromoSaving] = useState(false);

  const openAddPromo = () => {
    setNewPromo({ ...EMPTY_PROMO, startDate: isoDay(0), endDate: isoDay(30) });
    setPromoProductIds([]);
    setPromoActivateNow(true);
    setShowAddPromoModal(true);
  };

  const statusActionLabel: Record<PromotionAction, string> = {
    activate: "kích hoạt",
    pause: "tạm dừng",
    end: "kết thúc",
  };
  const handlePromoAction = async (
    promo: Promotion,
    action: PromotionAction,
  ) => {
    if (
      action === "end" &&
      !window.confirm(
        `Kết thúc chương trình ${promo.code}? Không thể kích hoạt lại sau khi kết thúc.`,
      )
    ) {
      return;
    }
    try {
      await onChangePromotionStatus(promo.id, action);
    } catch (err) {
      alert(
        `Không thể ${statusActionLabel[action]}: ` +
          (err instanceof Error ? err.message : "lỗi không xác định"),
      );
    }
  };

  // Lọc sản phẩm theo Category (khớp theo code hoặc categoryId) và từ khóa tìm kiếm
  const filteredProducts = products.filter((p) => {
    const matchCat =
      selectedCat === "all" ||
      p.category === selectedCat ||
      p.categoryId === selectedCat;
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

  const saveEditPrice = async (productId: string) => {
    if (!(editSellingPrice > 0) || editCostPrice < 0) {
      alert("Giá bán phải lớn hơn 0 và giá vốn không được âm!");
      return;
    }
    try {
      await onUpdateProductPrice(productId, editSellingPrice, editCostPrice);
      setEditingId(null);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Lỗi khi cập nhật giá trên hệ thống!",
      );
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newProd.code?.trim();
    const name = newProd.name?.trim();
    if (!code || !name) {
      setError("Vui lòng nhập mã và tên sản phẩm!");
      return;
    }

    const selectedCatItem = categories.find(
      (c) => c.code === newProd.category || c.id === newProd.categoryId,
    );

    setError(null);
    setSaving(true);
    try {
      await onAddProduct({
        code,
        name,
        category: (selectedCatItem?.code ||
          newProd.category ||
          "SUA_TUOI_TIET_TRUNG") as Category,
        categoryId: selectedCatItem?.id,
        unit: newProd.unit || "Hộp",
        sellingPrice: Number(newProd.sellingPrice),
        costPrice: Number(newProd.costPrice),
        minStockLevel: Number(newProd.minStockLevel) || 10,
        description: newProd.description || "",
        status: "active",
      });
      setShowAddModal(false);
      setNewProd(EMPTY_PRODUCT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được sản phẩm");
    } finally {
      setSaving(false);
    }
  };

  // === HANDLERS CHO CATEGORY CRUD ===
  const handleCreateCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCatCode.trim().toUpperCase();
    const name = newCatName.trim();
    if (!code || !name) {
      setCatError("Vui lòng nhập đầy đủ mã và tên danh mục!");
      return;
    }
    setCatSaving(true);
    setCatError(null);
    try {
      await createCategory({ code, name });
      setShowAddCatModal(false);
      setNewCatCode("");
      setNewCatName("");
    } catch (err: any) {
      setCatError(err?.message || "Lỗi khi tạo danh mục mới!");
    } finally {
      setCatSaving(false);
    }
  };

  const handleUpdateCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat) return;
    const name = editCatName.trim();
    if (!name) {
      setCatError("Tên danh mục không được để trống!");
      return;
    }
    setCatSaving(true);
    setCatError(null);
    try {
      await updateCategory(editingCat.id, {
        name,
        status: editCatStatus,
      });
      setEditingCat(null);
    } catch (err: any) {
      setCatError(err?.message || "Lỗi khi cập nhật danh mục!");
    } finally {
      setCatSaving(false);
    }
  };

  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newPromo.code?.trim().toUpperCase();
    if (!code || !newPromo.name?.trim()) {
      alert("Vui lòng nhập mã và tên chương trình khuyến mãi!");
      return;
    }
    if (promotions.some((p) => p.code === code)) {
      alert("Mã khuyến mãi đã tồn tại!");
      return;
    }
    const value = Number(newPromo.value);
    if (!(value > 0)) {
      alert("Giá trị giảm phải lớn hơn 0!");
      return;
    }
    if (newPromo.discountType === "percentage" && value > 100) {
      alert("Giảm theo % không được vượt quá 100!");
      return;
    }
    const startDate = newPromo.startDate || isoDay(0);
    const endDate = newPromo.endDate || isoDay(30);
    if (endDate < startDate) {
      alert("Ngày kết thúc không được trước ngày bắt đầu!");
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
    if (scope === "product" && promoProductIds.length === 0) {
      alert("Vui lòng chọn ít nhất 1 sản phẩm áp dụng!");
      return;
    }

    setPromoSaving(true);
    try {
      await onCreatePromotion({
        code,
        name: newPromo.name.trim(),
        description: newPromo.description,
        scope,
        discountType: newPromo.discountType as "percentage" | "fixed_amount",
        value,
        maxDiscountAmount:
          newPromo.discountType === "percentage" && newPromo.maxDiscountAmount
            ? Number(newPromo.maxDiscountAmount)
            : undefined,
        minOrderValue: Number(newPromo.minOrderValue) || 0,
        categoryCode:
          scope === "category" ? newPromo.applicableCategory : undefined,
        nearExpiryDays:
          scope === "near_expiry" ? Number(newPromo.nearExpiryDays) : undefined,
        productIds: scope === "product" ? promoProductIds : undefined,
        requiresCode: !!newPromo.requiresCode,
        usageLimit: newPromo.usageLimit
          ? Number(newPromo.usageLimit)
          : undefined,
        startDate,
        endDate,
        activateNow: promoActivateNow,
      });
      setShowAddPromoModal(false);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Không lưu được chương trình khuyến mãi",
      );
    } finally {
      setPromoSaving(false);
    }
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
            <span>2.1 Nhóm danh mục TH ({categories.length})</span>
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
            onClick={openAddModal}
            className="bg-[#004885] hover:bg-[#00386b] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm sản phẩm mới</span>
          </button>
        )}

        {activeTab === "categories" && (
          <button
            id="btn-open-add-category"
            onClick={() => {
              setCatError(null);
              setNewCatCode("");
              setNewCatName("");
              setShowAddCatModal(true);
            }}
            className="bg-[#004885] hover:bg-[#00386b] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm nhóm danh mục mới</span>
          </button>
        )}

        {activeTab === "promotions" && (
          <button
            id="btn-open-add-promo"
            onClick={openAddPromo}
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

            {/* Filter pills: Đồng bộ danh mục từ API */}
            <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
              <button
                onClick={() => setSelectedCat("all")}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  selectedCat === "all"
                    ? "bg-[#004885] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tất cả ({products.length})
              </button>
              {categories.map((c) => {
                const count = products.filter(
                  (p) => p.category === c.code || p.categoryId === c.id,
                ).length;
                return (
                  <button
                    key={c.id || c.code}
                    onClick={() => setSelectedCat(c.code)}
                    className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedCat === c.code
                        ? "bg-[#004885] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {c.name} ({count})
                  </button>
                );
              })}
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
                          <div className="relative group/img inline-block">
                            <img
                              src={assetUrl(p.imageUrl)}
                              alt={p.name}
                              className="w-16 h-16 object-contain rounded-xl border border-slate-200 bg-white p-1.5 transition-all duration-200 group-hover/img:scale-105 group-hover/img:border-[#004885] shadow-xs cursor-pointer"
                              onError={(e) => {
                                const target = e.currentTarget;
                                const cleanPath = p.imageUrl?.startsWith('/') ? p.imageUrl : `/${p.imageUrl}`;
                                if (target.src.includes(':3001')) {
                                  target.src = cleanPath;
                                } else {
                                  target.style.display = 'none';
                                  const fallback = target.parentElement?.nextElementSibling;
                                  if (fallback) fallback.style.display = 'flex';
                                }
                              }}
                            />
                            {/* Hover-Zoom Popup Preview */}
                            <div className="hidden group-hover/img:flex flex-col absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-50 bg-white p-3 rounded-2xl shadow-2xl border border-slate-200/80 w-48 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                              <div className="w-full h-40 bg-slate-50/80 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-100">
                                <img
                                  src={assetUrl(p.imageUrl)}
                                  alt={p.name}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <p className="text-xs font-bold text-slate-800 mt-2.5 line-clamp-2 leading-tight">{p.name}</p>
                              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500 font-mono">
                                <span className="bg-sky-50 text-[#004885] px-1.5 py-0.5 rounded font-bold">{p.code}</span>
                                <span>{p.unit}</span>
                              </div>
                            </div>
                          </div>
                        ) : null}
                        <div
                          className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 items-center justify-center text-slate-400"
                          style={{ display: p.imageUrl ? 'none' : 'flex' }}
                        >
                          <Package className="w-7 h-7" />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#004885]">
                        {p.code}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-xs">
                        {p.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <span className="bg-sky-50 text-[#004885] border border-sky-100 px-2 py-0.5 rounded text-[11px] font-medium">
                          {p.categoryName || getCategoryName(p.category)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{p.unit}</td>

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
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              className="text-amber-700 hover:text-amber-800 font-medium text-[11px] inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded transition-colors"
                              title="Chỉnh sửa toàn bộ thông tin sản phẩm"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Sửa</span>
                            </button>
                            <button
                              onClick={() => startEditPrice(p)}
                              className="text-[#004885] hover:text-[#00386b] font-medium text-[11px] inline-flex items-center gap-1 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded transition-colors"
                              title="Đổi nhanh giá bán & giá vốn"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Đổi giá</span>
                            </button>
                          </div>
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

      {/* 2.1: Nhóm danh mục TH kết nối API /api/categories với đầy đủ CRUD */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          {loadingCategories ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              Đang tải danh mục từ máy chủ...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat) => {
                const count = products.filter(
                  (p) => p.category === cat.code || p.categoryId === cat.id,
                ).length;
                return (
                  <div
                    key={cat.id || cat.code}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-sky-300 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-sky-50 text-[#004885] border border-sky-100">
                          {cat.code}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              cat.status === "active"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {cat.status === "active"
                              ? "Đang hoạt động"
                              : "Tạm ngưng"}
                          </span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {count} sản phẩm
                          </span>
                        </div>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900">
                        {cat.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Dòng sản phẩm nguyên chất tự nhiên tiêu chuẩn trang trại
                        TH True Milk.
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setEditingCat(cat);
                          setEditCatName(cat.name);
                          setEditCatStatus(cat.status || "active");
                          setCatError(null);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-[#004885] hover:bg-sky-50 rounded flex items-center gap-1 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Sửa</span>
                      </button>
                      <button
                        onClick={async () => {
                          if (count > 0) {
                            alert(
                              `Không thể xóa danh mục "${cat.name}" vì đang có ${count} sản phẩm thuộc danh mục này! Vui lòng chuyển trạng thái thành Tạm ngưng (inactive).`,
                            );
                            return;
                          }
                          if (
                            window.confirm(
                              `Bạn có chắc chắn muốn xóa danh mục "${cat.name}" (${cat.code}) khỏi hệ thống?`,
                            )
                          ) {
                            try {
                              await deleteCategory(cat.id);
                            } catch (err: any) {
                              alert(
                                "Lỗi khi xóa danh mục: " +
                                  (err.message || "Không xác định"),
                              );
                            }
                          }
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                {promo.description && (
                  <p className="text-xs text-slate-500">{promo.description}</p>
                )}
                <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    Phạm vi: {PROMOTION_SCOPE_LABELS[promo.scope]}
                  </span>
                  {promo.applicableCategory && (
                    <span className="bg-sky-50 text-[#004885] px-2 py-0.5 rounded">
                      Nhóm: {getCategoryName(promo.applicableCategory)}
                    </span>
                  )}
                  {promo.nearExpiryDays && (
                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                      Cận date ≤ {promo.nearExpiryDays} ngày
                    </span>
                  )}
                  {promo.minOrderValue > 0 && (
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      Đơn từ {promo.minOrderValue.toLocaleString("vi-VN")} đ
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {promo.startDate} → {promo.endDate}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {promo.status === "draft" && (
                    <button
                      onClick={() => handlePromoAction(promo, "activate")}
                      className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      Kích hoạt
                    </button>
                  )}
                  {promo.status === "active" && (
                    <button
                      onClick={() => handlePromoAction(promo, "pause")}
                      className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100"
                    >
                      Tạm dừng
                    </button>
                  )}
                  {promo.status === "paused" && (
                    <button
                      onClick={() => handlePromoAction(promo, "activate")}
                      className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      Tiếp tục
                    </button>
                  )}
                  {promo.status !== "expired" && (
                    <button
                      onClick={() => handlePromoAction(promo, "end")}
                      className="text-xs font-semibold px-2.5 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100"
                    >
                      Kết thúc
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Thêm nhóm danh mục mới */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#004885]" />
                <span>Thêm nhóm danh mục TH mới</span>
              </h3>
              <button
                onClick={() => setShowAddCatModal(false)}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {catError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{catError}</span>
              </div>
            )}

            <form
              onSubmit={handleCreateCategorySubmit}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Mã danh mục (Viết hoa không dấu, ví dụ: SUA_HAT, BANH_GAO)*
                </label>
                <input
                  type="text"
                  required
                  placeholder="Mã nhóm, vd: SUA_HAT"
                  value={newCatCode}
                  onChange={(e) => setNewCatCode(e.target.value.toUpperCase())}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tên hiển thị ngành hàng TH*
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Sữa hạt cao cấp TH True Nut"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={catSaving}
                  className="px-4 py-2 rounded-lg bg-[#004885] hover:bg-[#00386b] text-white font-bold disabled:opacity-60"
                >
                  {catSaving ? "Đang lưu..." : "Tạo danh mục"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chỉnh sửa danh mục */}
      {editingCat && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#004885]" />
                <span>Chỉnh sửa danh mục {editingCat.code}</span>
              </h3>
              <button
                onClick={() => setEditingCat(null)}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {catError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{catError}</span>
              </div>
            )}

            <form
              onSubmit={handleUpdateCategorySubmit}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tên hiển thị ngành hàng*
                </label>
                <input
                  type="text"
                  required
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Trạng thái hoạt động
                </label>
                <select
                  value={editCatStatus}
                  onChange={(e) => setEditCatStatus(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                >
                  <option value="active">Đang hoạt động (active)</option>
                  <option value="inactive">Tạm ngưng (inactive)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCat(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={catSaving}
                  className="px-4 py-2 rounded-lg bg-[#004885] hover:bg-[#00386b] text-white font-bold disabled:opacity-60"
                >
                  {catSaving ? "Đang lưu..." : "Cập nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chỉnh sửa toàn diện sản phẩm */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl my-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-600" />
                <span>Chỉnh sửa sản phẩm ({editingProduct.code})</span>
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {editProdError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{editProdError}</span>
                </div>
              )}

              <form
                id="editProductForm"
                onSubmit={handleSaveProductEdit}
                className="space-y-3.5 text-xs"
              >
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Mã sản phẩm (duy nhất)
                  </label>
                  <input
                    type="text"
                    value={editProdForm.code || ''}
                    onChange={(e) =>
                      setEditProdForm({ ...editProdForm, code: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-[#004885]"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tên sản phẩm
                  </label>
                  <input
                    type="text"
                    value={editProdForm.name || ''}
                    onChange={(e) =>
                      setEditProdForm({ ...editProdForm, name: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-900"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Danh mục (Từ API Categories)
                    </label>
                    <select
                      value={editProdForm.category || ''}
                      onChange={(e) => {
                        const selected = categories.find(
                          (c) =>
                            c.code === e.target.value ||
                            c.id === e.target.value,
                        );
                        setEditProdForm({
                          ...editProdForm,
                          category: (selected?.code || e.target.value) as any,
                          categoryId: selected?.id,
                        });
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      {categories.map((c) => (
                        <option key={c.id || c.code} value={c.code}>
                          {c.name} ({c.code})
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
                      value={editProdForm.unit || ''}
                      onChange={(e) =>
                        setEditProdForm({ ...editProdForm, unit: e.target.value })
                      }
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
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
                      value={editProdForm.costPrice ?? 0}
                      onChange={(e) =>
                        setEditProdForm({
                          ...editProdForm,
                          costPrice: Number(e.target.value),
                        })
                      }
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Giá bán (VNĐ)
                    </label>
                    <input
                      type="number"
                      value={editProdForm.sellingPrice ?? 0}
                      onChange={(e) =>
                        setEditProdForm({
                          ...editProdForm,
                          sellingPrice: Number(e.target.value),
                        })
                      }
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-[#004885]"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Định mức tồn tối thiểu
                    </label>
                    <input
                      type="number"
                      value={editProdForm.minStockLevel ?? 0}
                      onChange={(e) =>
                        setEditProdForm({
                          ...editProdForm,
                          minStockLevel: Number(e.target.value),
                        })
                      }
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Trạng thái kinh doanh
                    </label>
                    <select
                      value={editProdForm.status || 'active'}
                      onChange={(e) =>
                        setEditProdForm({
                          ...editProdForm,
                          status: e.target.value as any,
                        })
                      }
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                    >
                      <option value="active">Đang kinh doanh</option>
                      <option value="discontinued">Ngừng kinh doanh</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Đường dẫn ảnh sản phẩm (imageUrl)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editProdForm.imageUrl || ''}
                      onChange={(e) =>
                        setEditProdForm({ ...editProdForm, imageUrl: e.target.value })
                      }
                      className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px]"
                      placeholder="VD: /uploads/products/TH-FRESH-1L.webp"
                    />
                    {editProdForm.imageUrl && (
                      <div className="w-10 h-10 border border-slate-200 rounded-lg bg-white overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                        <img
                          src={assetUrl(editProdForm.imageUrl)}
                          alt="Preview"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Mô tả sản phẩm
                  </label>
                  <textarea
                    rows={2}
                    value={editProdForm.description || ''}
                    onChange={(e) =>
                      setEditProdForm({ ...editProdForm, description: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="Đặc tính, thành phần tự nhiên..."
                  />
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium text-xs transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                form="editProductForm"
                disabled={editProdSaving}
                className="px-5 py-2 bg-[#004885] hover:bg-[#00386b] text-white rounded-lg font-bold text-xs disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-colors"
              >
                {editProdSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Thêm sản phẩm mới */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#004885]" />
                <span>Thêm sản phẩm TH mới</span>
              </h3>
              <button
                onClick={closeAddModal}
                className="text-slate-400 hover:bg-slate-100 p-2 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {error}
                </div>
              )}

              <form
                id="addProductForm"
                onSubmit={handleCreateProduct}
                className="space-y-3 text-xs"
              >
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Mã sản phẩm (duy nhất)
                  </label>
                  <input
                    type="text"
                    value={newProd.code}
                    onChange={(e) =>
                      setNewProd({ ...newProd, code: e.target.value })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                    placeholder="VD: TH009"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tên sản phẩm
                  </label>
                  <input
                    type="text"
                    value={newProd.name}
                    onChange={(e) =>
                      setNewProd({ ...newProd, name: e.target.value })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="VD: Sữa tươi tiệt trùng TH True MILK ít đường 180ml"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Danh mục (Từ API Categories)
                    </label>
                    <select
                      value={newProd.category}
                      onChange={(e) => {
                        const selected = categories.find(
                          (c) =>
                            c.code === e.target.value ||
                            c.id === e.target.value,
                        );
                        setNewProd({
                          ...newProd,
                          category: (selected?.code || e.target.value) as any,
                          categoryId: selected?.id,
                        });
                      }}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      {categories.map((c) => (
                        <option key={c.id || c.code} value={c.code}>
                          {c.name} ({c.code})
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
                      Giá bán (VNĐ)
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

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Định mức tồn tối thiểu (cảnh báo nhập kho)
                  </label>
                  <input
                    type="number"
                    value={newProd.minStockLevel}
                    onChange={(e) =>
                      setNewProd({
                        ...newProd,
                        minStockLevel: Number(e.target.value),
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Mô tả sản phẩm
                  </label>
                  <textarea
                    rows={2}
                    value={newProd.description}
                    onChange={(e) =>
                      setNewProd({ ...newProd, description: e.target.value })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="Đặc tính, thành phần tự nhiên..."
                  />
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-2xl">
              <button
                type="button"
                onClick={closeAddModal}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium text-xs"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                form="addProductForm"
                disabled={saving}
                className="px-5 py-2 bg-[#004885] hover:bg-[#00386b] text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-60"
              >
                {saving ? "Đang lưu..." : "Lưu sản phẩm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tạo khuyến mãi mới */}
      {showAddPromoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-600" />
                <span>Tạo chương trình khuyến mãi TH</span>
              </h3>
              <button
                onClick={() => setShowAddPromoModal(false)}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreatePromotion}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Mã CTKM (viết hoa)*
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: THMILK10"
                    value={newPromo.code}
                    onChange={(e) =>
                      setNewPromo({
                        ...newPromo,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tên chương trình*
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Giảm 10% sữa tiệt trùng"
                    value={newPromo.name}
                    onChange={(e) =>
                      setNewPromo({ ...newPromo, name: e.target.value })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Mô tả
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú điều kiện áp dụng..."
                  value={newPromo.description || ""}
                  onChange={(e) =>
                    setNewPromo({ ...newPromo, description: e.target.value })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
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
                    <option value="order">Toàn đơn hàng (order)</option>
                    <option value="category">Nhóm hàng (category)</option>
                    <option value="product">Sản phẩm cụ thể (product)</option>
                    <option value="near_expiry">
                      Xả hàng cận date (near_expiry)
                    </option>
                  </select>
                </div>
                {newPromo.scope === "category" && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Nhóm hàng (Từ API Categories)
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
                        <option key={c.id || c.code} value={c.code}>
                          {c.name} ({c.code})
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
                      placeholder="VD: 15 hoặc 30"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Hình thức giảm
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
                    <option value="percentage">Theo phần trăm (%)</option>
                    <option value="fixed_amount">Số tiền cố định (đ)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Mức giảm*{" "}
                    {newPromo.discountType === "percentage" ? "(%)" : "(đ)"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={
                      newPromo.discountType === "percentage" ? 100 : undefined
                    }
                    required
                    value={newPromo.value ?? ""}
                    onChange={(e) =>
                      setNewPromo({
                        ...newPromo,
                        value: Number(e.target.value),
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Từ ngày
                  </label>
                  <input
                    type="date"
                    value={newPromo.startDate || ""}
                    onChange={(e) =>
                      setNewPromo({ ...newPromo, startDate: e.target.value })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Đến hết ngày
                  </label>
                  <input
                    type="date"
                    value={newPromo.endDate || ""}
                    onChange={(e) =>
                      setNewPromo({ ...newPromo, endDate: e.target.value })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Đơn tối thiểu (đ)
                </label>
                <input
                  type="number"
                  min={0}
                  value={newPromo.minOrderValue ?? 0}
                  onChange={(e) =>
                    setNewPromo({
                      ...newPromo,
                      minOrderValue: Number(e.target.value),
                    })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              {newPromo.scope === "product" && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Sản phẩm áp dụng ({promoProductIds.length} đã chọn)
                  </label>
                  <div className="max-h-32 overflow-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {products.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={promoProductIds.includes(p.id)}
                          onChange={(e) =>
                            setPromoProductIds((prev) =>
                              e.target.checked
                                ? [...prev, p.id]
                                : prev.filter((x) => x !== p.id),
                            )
                          }
                          className="rounded text-[#004885]"
                        />
                        <span>{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={promoActivateNow}
                  onChange={(e) => setPromoActivateNow(e.target.checked)}
                  className="rounded text-[#004885]"
                />
                <span className="text-slate-700 font-medium">
                  Kích hoạt ngay sau khi tạo (bỏ chọn = lưu nháp)
                </span>
              </label>

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
                  disabled={promoSaving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-xs disabled:opacity-60"
                >
                  {promoSaving ? "Đang lưu..." : "Tạo chương trình khuyến mãi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
