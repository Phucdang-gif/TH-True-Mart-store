import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Award, 
  Gift, 
  History, 
  Search, 
  Phone, 
  Mail, 
  X,
  CreditCard
} from 'lucide-react';
import { Customer, Invoice } from '../../types';

interface QuanLyKhachHangProps {
  customers: Customer[];
  invoices: Invoice[];
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomerPoints: (customerId: string, deltaPoints: number) => void;
}

export const QuanLyKhachHang: React.FC<QuanLyKhachHangProps> = ({
  customers,
  invoices,
  onAddCustomer,
  onUpdateCustomerPoints
}) => {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [pointDelta, setPointDelta] = useState<number>(50);
  const [pointAction, setPointAction] = useState<'add' | 'subtract'>('add');

  // New Customer State (4.1)
  const [newCust, setNewCust] = useState({
    code: `KH-${Math.floor(1000 + Math.random() * 9000)}`,
    name: '',
    phone: '',
    email: '',
    tier: 'Standard' as const
  });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const customerInvoices = selectedCustomer
    ? invoices.filter(inv => inv.customerId === selectedCustomer.id || inv.customerPhone === selectedCustomer.phone)
    : [];

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust.name || !newCust.phone) {
      alert('Vui lòng nhập tên và số điện thoại khách hàng!');
      return;
    }
    const customerToAdd: Customer = {
      id: `cust-${Date.now()}`,
      code: newCust.code,
      name: newCust.name,
      phone: newCust.phone,
      email: newCust.email,
      points: 10, // Tặng 10 điểm chào mừng thành viên mới
      tier: 'Standard',
      createdAt: new Date().toISOString().slice(0, 10),
      totalSpent: 0
    };
    onAddCustomer(customerToAdd);
    setShowAddModal(false);
  };

  const handlePointsChange = () => {
    if (!selectedCustomer) return;
    const delta = pointAction === 'add' ? Number(pointDelta) : -Number(pointDelta);
    onUpdateCustomerPoints(selectedCustomer.id, delta);
    setShowPointsModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Header and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="font-bold text-sm text-slate-900">4. Quản lý khách hàng & Thành viên TH Club</h3>
          <p className="text-xs text-slate-500">Chăm sóc khách hàng thân thiết, chương trình tích lũy True Point đổi quà</p>
        </div>

        <button
          id="btn-open-add-customer"
          onClick={() => setShowAddModal(true)}
          className="bg-[#004885] hover:bg-[#00386b] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>4.1 Đăng ký thành viên mới</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Customer List (4.1 & 4.2) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, SĐT khách hàng..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:bg-white"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Mã KH</th>
                  <th className="py-2.5 px-3">Họ tên & SĐT</th>
                  <th className="py-2.5 px-3 text-center">Hạng thẻ</th>
                  <th className="py-2.5 px-3 text-right">Điểm True Point</th>
                  <th className="py-2.5 px-3 text-right">Tổng chi tiêu</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map(cust => (
                  <tr
                    key={cust.id}
                    onClick={() => setSelectedCustomer(cust)}
                    className={`cursor-pointer transition-colors ${
                      selectedCustomer?.id === cust.id ? 'bg-sky-50/80 font-medium' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-[#004885]">{cust.code}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{cust.name}</div>
                      <div className="text-[11px] text-slate-500">{cust.phone}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cust.tier === 'Diamond' ? 'bg-purple-100 text-purple-800' :
                        cust.tier === 'Gold' ? 'bg-amber-100 text-amber-800' :
                        cust.tier === 'Silver' ? 'bg-slate-200 text-slate-800' : 'bg-sky-100 text-sky-800'
                      }`}>
                        {cust.tier}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                      {cust.points} đ
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                      {cust.totalSpent.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomer(cust);
                          setShowPointsModal(true);
                        }}
                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded font-semibold text-[11px] inline-flex items-center gap-1"
                      >
                        <Gift className="w-3 h-3" />
                        <span>Đổi điểm</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Detail & Purchase History (4.3 Tra cứu lịch sử mua hàng) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          {selectedCustomer ? (
            <>
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-[#004885] px-2 py-0.5 rounded">
                    Thành viên {selectedCustomer.tier}
                  </span>
                  <h4 className="font-bold text-base text-slate-900">{selectedCustomer.name}</h4>
                  <p className="text-xs text-slate-500">{selectedCustomer.phone} {selectedCustomer.email && `• ${selectedCustomer.email}`}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Điểm tích lũy</span>
                  <span className="text-lg font-black text-emerald-700">{selectedCustomer.points} pt</span>
                </div>
              </div>

              {/* 4.3 Purchase History */}
              <div className="space-y-3">
                <h5 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#004885]" />
                  <span>4.3 Lịch sử mua hàng tại TH true mart ({customerInvoices.length} đơn)</span>
                </h5>

                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {customerInvoices.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">Chưa có dữ liệu hóa đơn của khách hàng này.</p>
                  ) : (
                    customerInvoices.map(inv => (
                      <div key={inv.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-[#004885]">{inv.code}</span>
                          <span>{inv.finalTotal.toLocaleString('vi-VN')} đ</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>{inv.createdAt}</span>
                          <span>+{inv.pointsEarned} điểm</span>
                        </div>
                        <div className="border-t border-slate-200/60 pt-1.5 text-[11px] text-slate-700">
                          {inv.items.map((i, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span className="truncate max-w-[200px]">{i.productName} (x{i.quantity})</span>
                              <span>{i.subtotal.toLocaleString('vi-VN')} đ</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Users className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-medium">Chọn một khách hàng ở bảng bên trái để tra cứu điểm và lịch sử hóa đơn mua hàng.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: 4.1 Đăng ký khách hàng mới */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">4.1 Đăng ký thành viên TH Club</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Mã khách hàng</label>
                <input
                  type="text"
                  value={newCust.code}
                  readOnly
                  className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold text-slate-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Họ và tên khách hàng</label>
                <input
                  type="text"
                  placeholder="VD: Lê Hoàng Nam"
                  value={newCust.name}
                  onChange={(e) => setNewCust({...newCust, name: e.target.value})}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Số điện thoại (dùng tích điểm)</label>
                <input
                  type="tel"
                  placeholder="09xxxxxxxx"
                  value={newCust.phone}
                  onChange={(e) => setNewCust({...newCust, phone: e.target.value})}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Email nhận ưu đãi (không bắt buộc)</label>
                <input
                  type="email"
                  placeholder="khachhang@example.com"
                  value={newCust.email}
                  onChange={(e) => setNewCust({...newCust, email: e.target.value})}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="bg-sky-50 p-2.5 rounded-lg border border-sky-100 text-sky-800 text-[11px]">
                🎁 Thành viên mới được tặng ngay 10 điểm True Point chào mừng!
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
                  Xác nhận đăng ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: 4.2 Tích điểm / Đổi điểm */}
      {showPointsModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">4.2 Tích điểm / Đổi quà TH Point</h3>
              <button onClick={() => setShowPointsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Khách hàng: <span className="font-bold text-slate-900">{selectedCustomer.name}</span>
                <br />Điểm hiện tại: <span className="font-bold text-emerald-700">{selectedCustomer.points} điểm</span>
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPointAction('add')}
                  className={`p-2 rounded-lg border font-bold ${
                    pointAction === 'add' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  + Cộng thêm điểm
                </button>
                <button
                  type="button"
                  onClick={() => setPointAction('subtract')}
                  className={`p-2 rounded-lg border font-bold ${
                    pointAction === 'subtract' ? 'bg-rose-50 border-rose-500 text-rose-800' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  - Đổi quà (Trừ điểm)
                </button>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Số điểm thao tác</label>
                <input
                  type="number"
                  value={pointDelta}
                  onChange={(e) => setPointDelta(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm"
                  min="1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPointsModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handlePointsChange}
                  className="px-4 py-2 bg-[#004885] hover:bg-[#00386b] text-white rounded-lg font-bold shadow-xs"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
