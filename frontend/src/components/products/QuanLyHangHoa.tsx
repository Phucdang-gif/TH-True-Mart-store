import React, { useState } from 'react';
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
  Sparkles
} from 'lucide-react';
import { Product, Promotion, Category } from '../../types';

interface QuanLyHangHoaProps {
  products: Product[];
  promotions: Promotion[];
  onUpdateProductPrice: (productId: string, newSellingPrice: number, newCostPrice: number) => void;
  onAddProduct: (product: Product) => void;
  onAddPromotion: (promo: Promotion) => void;
}

export const QuanLyHangHoa: React.FC<QuanLyHangHoaProps> = ({
  products,
  promotions,
  onUpdateProductPrice,
  onAddProduct,
  onAddPromotion
}) => {
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'promotions'>('products');
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  
  // Price inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSellingPrice, setEditSellingPrice] = useState<number>(0);
  const [editCostPrice, setEditCostPrice] = useState<number>(0);

  // New Product Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProd, setNewProd] = useState<Partial<Product>>({
    code: `TH-MILK-${Math.floor(100 + Math.random() * 900)}`,
    name: '',
    category: 'Sữa tươi tiệt trùng',
    unit: 'Lốc 4 hộp',
    sellingPrice: 38000,
    costPrice: 30000,
    barcode: `89360360${Math.floor(10000 + Math.random() * 90000)}`,
    minStockLevel: 20,
    description: '',
    status: 'active'
  });

  // New Promotion Modal
  const [showAddPromoModal, setShowAddPromoModal] = useState(false);
  const [newPromo, setNewPromo] = useState<Partial<Promotion>>({
    code: 'THPROMO2026',
    name: '',
    discountType: 'percentage',
    value: 10,
    startDate: '2026-09-20',
    endDate: '2026-10-20',
    minOrderValue: 150000,
    status: 'active'
  });

  const categories: Category[] = [
    'Sữa tươi tiệt trùng',
    'Sữa tươi thanh trùng',
    'Sữa chua ăn & uống',
    'Bơ & Phô mai tự nhiên',
    'Kem TH true ICE CREAM',
    'Nước tinh khiết & Nước trái cây',
    'Trà tự nhiên TH true TEA'
  ];

  const filteredProducts = products.filter(p => {
    const matchCat = selectedCat === 'all' || p.category === selectedCat;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                        p.code.toLowerCase().includes(search.toLowerCase()) ||
                        p.barcode.includes(search);
    return matchCat && matchSearch;
  });

  const startEditPrice = (p: Product) => {
    setEditingId(p.id);
    setEditSellingPrice(p.sellingPrice);
    setEditCostPrice(p.costPrice);
  };

  const saveEditPrice = (productId: string) => {
    onUpdateProductPrice(productId, editSellingPrice, editCostPrice);
    setEditingId(null);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.name) {
      alert('Vui lòng nhập tên sản phẩm!');
      return;
    }
    const productToAdd: Product = {
      id: `prod-${Date.now()}`,
      code: newProd.code || 'TH-CUSTOM',
      name: newProd.name,
      category: newProd.category as Category,
      unit: newProd.unit || 'Hộp',
      sellingPrice: Number(newProd.sellingPrice),
      costPrice: Number(newProd.costPrice),
      barcode: newProd.barcode || '',
      minStockLevel: Number(newProd.minStockLevel) || 10,
      description: newProd.description || '',
      status: 'active'
    };
    onAddProduct(productToAdd);
    setShowAddModal(false);
  };

  const handleCreatePromotion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromo.code || !newPromo.name) {
      alert('Vui lòng nhập mã và tên chương trình khuyến mãi!');
      return;
    }
    const promoToAdd: Promotion = {
      id: `promo-${Date.now()}`,
      code: newPromo.code.toUpperCase(),
      name: newPromo.name,
      discountType: newPromo.discountType as 'percentage' | 'fixed_amount',
      value: Number(newPromo.value),
      startDate: newPromo.startDate || '2026-09-20',
      endDate: newPromo.endDate || '2026-10-20',
      minOrderValue: Number(newPromo.minOrderValue) || 0,
      applicableCategory: newPromo.applicableCategory,
      status: 'active'
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
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'products'
                ? 'bg-[#004885] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>2.1 & 2.2 Danh mục & Cập nhật giá bán</span>
          </button>
          <button
            id="tab-categories"
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'categories'
                ? 'bg-[#004885] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2.1 Nhóm danh mục TH</span>
          </button>
          <button
            id="tab-promotions"
            onClick={() => setActiveTab('promotions')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'promotions'
                ? 'bg-[#004885] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>2.3 Quản lý khuyến mãi ({promotions.length})</span>
          </button>
        </div>

        {activeTab === 'products' && (
          <button
            id="btn-open-add-product"
            onClick={() => setShowAddModal(true)}
            className="bg-[#004885] hover:bg-[#00386b] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm sản phẩm mới</span>
          </button>
        )}

        {activeTab === 'promotions' && (
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
      {activeTab === 'products' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã SP, tên sữa, barcode..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:bg-white"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto">
              <button
                onClick={() => setSelectedCat('all')}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  selectedCat === 'all' ? 'bg-[#004885] text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Tất cả ({products.length})
              </button>
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedCat(c)}
                  className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap ${
                    selectedCat === c ? 'bg-[#004885] text-white' : 'bg-slate-100 text-slate-600'
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
                  <th className="py-2.5 px-3">Mã SP</th>
                  <th className="py-2.5 px-3">Tên sản phẩm TH</th>
                  <th className="py-2.5 px-3">Danh mục</th>
                  <th className="py-2.5 px-3">Đơn vị</th>
                  <th className="py-2.5 px-3">Barcode</th>
                  <th className="py-2.5 px-3 text-right">Giá vốn (VNĐ)</th>
                  <th className="py-2.5 px-3 text-right">Giá bán (VNĐ) (2.2)</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(p => {
                  const isEditing = editingId === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#004885]">{p.code}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-xs">{p.name}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{p.unit}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{p.barcode}</td>
                      
                      {/* Cost Price */}
                      <td className="py-2.5 px-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editCostPrice}
                            onChange={(e) => setEditCostPrice(Number(e.target.value))}
                            className="w-24 px-1.5 py-0.5 border border-sky-500 rounded text-right font-semibold bg-white"
                          />
                        ) : (
                          <span className="text-slate-500">{p.costPrice.toLocaleString('vi-VN')} đ</span>
                        )}
                      </td>

                      {/* Selling Price (2.2 Cập nhật giá bán) */}
                      <td className="py-2.5 px-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editSellingPrice}
                            onChange={(e) => setEditSellingPrice(Number(e.target.value))}
                            className="w-28 px-1.5 py-0.5 border-2 border-[#004885] rounded text-right font-bold text-[#004885] bg-white"
                          />
                        ) : (
                          <span className="font-bold text-[#004885]">{p.sellingPrice.toLocaleString('vi-VN')} đ</span>
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
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => {
            const count = products.filter(p => p.category === cat).length;
            return (
              <div key={cat} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-sky-50 text-[#004885] flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {count} sản phẩm
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">{cat}</h4>
                <p className="text-xs text-slate-500">
                  Dòng sản phẩm nguyên chất tự nhiên tiêu chuẩn trang trại TH.
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* 2.3: Promotions List */}
      {activeTab === 'promotions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {promotions.map(promo => (
            <div key={promo.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded">
                    {promo.code}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {promo.status === 'active' ? 'Đang áp dụng' : 'Hết hạn'}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">{promo.name}</h4>
                <p className="text-xs text-slate-600">
                  Ưu đãi: <span className="font-bold text-rose-600">
                    {promo.discountType === 'percentage' ? `Giảm ${promo.value}%` : `Giảm ${promo.value.toLocaleString('vi-VN')} đ`}
                  </span>
                </p>
                {promo.minOrderValue > 0 && (
                  <p className="text-[11px] text-slate-500">
                    Đơn tối thiểu: {promo.minOrderValue.toLocaleString('vi-VN')} đ
                  </p>
                )}
              </div>

              <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Thời hạn: {promo.startDate} đến {promo.endDate}</span>
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
              <h3 className="font-bold text-sm text-slate-900">Thêm sản phẩm TH true milk mới</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mã sản phẩm</label>
                  <input
                    type="text"
                    value={newProd.code}
                    onChange={(e) => setNewProd({...newProd, code: e.target.value})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mã Barcode</label>
                  <input
                    type="text"
                    value={newProd.barcode}
                    onChange={(e) => setNewProd({...newProd, barcode: e.target.value})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tên sản phẩm</label>
                <input
                  type="text"
                  placeholder="VD: Sữa tươi tiệt trùng TH true MILK Dâu 180ml"
                  value={newProd.name}
                  onChange={(e) => setNewProd({...newProd, name: e.target.value})}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Danh mục</label>
                  <select
                    value={newProd.category}
                    onChange={(e) => setNewProd({...newProd, category: e.target.value as Category})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Đơn vị tính</label>
                  <input
                    type="text"
                    value={newProd.unit}
                    onChange={(e) => setNewProd({...newProd, unit: e.target.value})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    placeholder="Lốc 4 hộp, Thùng, Hũ..."
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Giá vốn (VNĐ)</label>
                  <input
                    type="number"
                    value={newProd.costPrice}
                    onChange={(e) => setNewProd({...newProd, costPrice: Number(e.target.value)})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Giá bán niêm yết (VNĐ)</label>
                  <input
                    type="number"
                    value={newProd.sellingPrice}
                    onChange={(e) => setNewProd({...newProd, sellingPrice: Number(e.target.value)})}
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
              <h3 className="font-bold text-sm text-slate-900">Tạo chương trình khuyến mãi mới</h3>
              <button onClick={() => setShowAddPromoModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePromotion} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Mã khuyến mãi (Voucher Code)</label>
                <input
                  type="text"
                  value={newPromo.code}
                  onChange={(e) => setNewPromo({...newPromo, code: e.target.value.toUpperCase()})}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono uppercase font-bold"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tên chương trình</label>
                <input
                  type="text"
                  placeholder="VD: Khuyến mãi mừng ngày Nhà giáo..."
                  value={newPromo.name}
                  onChange={(e) => setNewPromo({...newPromo, name: e.target.value})}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Loại giảm giá</label>
                  <select
                    value={newPromo.discountType}
                    onChange={(e) => setNewPromo({...newPromo, discountType: e.target.value as any})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="percentage">Giảm theo %</option>
                    <option value="fixed_amount">Giảm số tiền cố định</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Giá trị giảm</label>
                  <input
                    type="number"
                    value={newPromo.value}
                    onChange={(e) => setNewPromo({...newPromo, value: Number(e.target.value)})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                    required
                  />
                </div>
              </div>

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
                  Kích hoạt khuyến mãi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
