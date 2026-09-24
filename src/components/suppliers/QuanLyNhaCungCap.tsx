import React, { useState } from 'react';
import { 
  Truck, 
  FileText, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  CheckCircle,
  Clock,
  X
} from 'lucide-react';
import { Supplier, PurchaseOrder, Product } from '../../types';

interface QuanLyNhaCungCapProps {
  suppliers: Supplier[];
  products: Product[];
  purchaseOrders: PurchaseOrder[];
  onAddSupplier: (supplier: Supplier) => void;
  onCreatePurchaseOrder: (po: PurchaseOrder) => void;
}

export const QuanLyNhaCungCap: React.FC<QuanLyNhaCungCapProps> = ({
  suppliers,
  products,
  purchaseOrders,
  onAddSupplier,
  onCreatePurchaseOrder
}) => {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers');
  const [search, setSearch] = useState('');
  
  // Modals
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);

  // New Supplier State (6.1)
  const [newSup, setNewSup] = useState({
    code: `NCC-${Math.floor(10 + Math.random() * 90)}`,
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    categoryProvided: 'Sữa tươi & Chế phẩm sữa TH'
  });

  // New Purchase Order State (6.2)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [expectedDate, setExpectedDate] = useState('2026-09-25');
  const [poItems, setPoItems] = useState<{ productId: string; quantity: number }[]>([
    { productId: products[0]?.id || '', quantity: 50 }
  ]);
  const [poNotes, setPoNotes] = useState('');

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    s.contactPerson.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSup.name) return;
    const supToAdd: Supplier = {
      id: `sup-${Date.now()}`,
      code: newSup.code,
      name: newSup.name,
      contactPerson: newSup.contactPerson,
      phone: newSup.phone,
      email: newSup.email,
      address: newSup.address,
      categoryProvided: newSup.categoryProvided,
      status: 'active'
    };
    onAddSupplier(supToAdd);
    setShowAddSupplierModal(false);
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find(s => s.id === selectedSupplierId);
    if (!sup) return;

    const items = poItems.map(item => {
      const prod = products.find(p => p.id === item.productId);
      const unitPrice = prod?.costPrice || 30000;
      return {
        productId: item.productId,
        productName: prod?.name || 'Sản phẩm',
        quantity: item.quantity,
        unitPrice,
        subtotal: unitPrice * item.quantity
      };
    });

    const totalAmount = items.reduce((acc, i) => acc + i.subtotal, 0);

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      orderCode: `PO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(10 + Math.random() * 90)}`,
      supplierId: sup.id,
      supplierName: sup.name,
      createdAt: new Date().toLocaleString('vi-VN'),
      expectedDate,
      items,
      totalAmount,
      status: 'pending',
      notes: poNotes
    };

    onCreatePurchaseOrder(newPO);
    setShowCreateOrderModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'suppliers'
                ? 'bg-[#004885] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>6.1 Danh sách nhà cung cấp ({suppliers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'orders'
                ? 'bg-[#004885] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>6.2 Đơn đặt hàng nhập kho ({purchaseOrders.length})</span>
          </button>
        </div>

        {activeTab === 'suppliers' ? (
          <button
            onClick={() => setShowAddSupplierModal(true)}
            className="bg-[#004885] hover:bg-[#00386b] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm nhà cung cấp mới</span>
          </button>
        ) : (
          <button
            onClick={() => setShowCreateOrderModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Lập đơn đặt hàng (PO) mới</span>
          </button>
        )}
      </div>

      {/* 6.1: Suppliers Cards */}
      {activeTab === 'suppliers' && (
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
            {filteredSuppliers.map(sup => (
              <div key={sup.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs bg-sky-50 text-[#004885] px-2 py-0.5 rounded">
                      {sup.code}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Đối tác chính thức
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-900 leading-snug">{sup.name}</h4>
                  
                  <div className="space-y-1 text-xs text-slate-600 pt-1">
                    <p className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800">Liên hệ:</span> {sup.contactPerson}
                    </p>
                    <p className="flex items-center gap-1.5 text-slate-500">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{sup.phone}</span>
                    </p>
                    <p className="flex items-center gap-1.5 text-slate-500">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{sup.email}</span>
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
      {activeTab === 'orders' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">6.2 Danh sách đơn đặt hàng nhập kho (PO)</h3>
              <p className="text-xs text-slate-500">Theo dõi tiến độ giao hàng từ trang trại TH và các nhà cung cấp bao bì nguyên liệu</p>
            </div>
          </div>

          <div className="space-y-3">
            {purchaseOrders.map(po => (
              <div key={po.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#004885]">{po.orderCode}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold text-slate-900">{po.supplierName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Dự kiến nhận: <strong className="text-slate-800">{po.expectedDate}</strong></span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Chờ tiếp nhận kho
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  {po.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-slate-700">
                      <span>• {item.productName} (Số lượng: <strong>{item.quantity}</strong>)</span>
                      <span className="font-semibold">{item.subtotal.toLocaleString('vi-VN')} đ</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center border-t border-slate-200 pt-2 font-bold text-xs">
                  <span className="text-slate-600">Tổng giá trị đơn hàng:</span>
                  <span className="text-sm text-[#004885]">{po.totalAmount.toLocaleString('vi-VN')} đ</span>
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
              <h3 className="font-bold text-sm text-slate-900">Thêm nhà cung cấp mới</h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Mã nhà cung cấp</label>
                <input
                  type="text"
                  value={newSup.code}
                  onChange={(e) => setNewSup({...newSup, code: e.target.value})}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tên đơn vị cung cấp</label>
                <input
                  type="text"
                  placeholder="VD: Trang trại bò sữa TH số 3 Nghĩa Đàn"
                  value={newSup.name}
                  onChange={(e) => setNewSup({...newSup, name: e.target.value})}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Người đại diện</label>
                  <input
                    type="text"
                    value={newSup.contactPerson}
                    onChange={(e) => setNewSup({...newSup, contactPerson: e.target.value})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    value={newSup.phone}
                    onChange={(e) => setNewSup({...newSup, phone: e.target.value})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Địa chỉ</label>
                <input
                  type="text"
                  value={newSup.address}
                  onChange={(e) => setNewSup({...newSup, address: e.target.value})}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#004885] hover:bg-[#00386b] text-white rounded-lg font-bold shadow-xs"
                >
                  Lưu nhà cung cấp
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
              <h3 className="font-bold text-sm text-slate-900">6.2 Lập đơn đặt hàng nhập kho (PO)</h3>
              <button onClick={() => setShowCreateOrderModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nhà cung cấp tiếp nhận</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ngày dự kiến giao hàng</label>
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
                <label className="font-bold text-slate-700 block mb-1">Sản phẩm & Số lượng đặt</label>
                <div className="space-y-2">
                  {poItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <select
                        value={item.productId}
                        onChange={(e) => {
                          const updated = [...poItems];
                          updated[idx].productId = e.target.value;
                          setPoItems(updated);
                        }}
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...poItems];
                          updated[idx].quantity = Number(e.target.value);
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
                <label className="font-bold text-slate-700 block mb-1">Ghi chú đơn hàng</label>
                <textarea
                  rows={2}
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Ghi chú yêu cầu nhiệt độ bảo quản lạnh, xe chuyên dụng..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateOrderModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-xs"
                >
                  Gửi đơn đặt hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
