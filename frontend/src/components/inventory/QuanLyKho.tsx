import React, { useState } from 'react';
import { 
  Warehouse, 
  AlertTriangle, 
  PlusCircle, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  ClipboardCheck, 
  Search, 
  Calendar,
  Clock,
  CheckCircle2,
  X
} from 'lucide-react';
import { Product, Batch, StockAudit, StockAuditItem, Staff } from '../../types';

interface QuanLyKhoProps {
  products: Product[];
  batches: Batch[];
  onAddBatch: (batch: Batch) => void;
  onAdjustStock: (batchId: string, newQuantity: number, reason: string) => void;
  currentStaff: Staff; // người nhập kho / kiểm kê / duyệt
  audits: StockAudit[]; // phiếu kiểm kê (stock_audits)
  onSubmitAudit: (audit: StockAudit) => void;
  onReviewAudit: (auditId: string, approved: boolean, approverId: string) => void;
}

export const QuanLyKho: React.FC<QuanLyKhoProps> = ({
  products,
  batches,
  onAddBatch,
  onAdjustStock,
  currentStaff,
  audits,
  onSubmitAudit,
  onReviewAudit
}) => {
  const [activeTab, setActiveTab] = useState<'batches' | 'alerts' | 'import' | 'audit'>('batches');
  const [search, setSearch] = useState('');

  // New Batch Input (3.1)
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedProductForImport, setSelectedProductForImport] = useState<string>(products[0]?.id || '');
  const [batchCode, setBatchCode] = useState(`LOTH-${new Date().toISOString().slice(0,7).replace('-','')}-${Math.floor(10 + Math.random() * 90)}`);
  const [mfgDate, setMfgDate] = useState('2026-09-15');
  const [expDate, setExpDate] = useState('2027-03-15');
  const [importQty, setImportQty] = useState<number>(100);
  const [importPrice, setImportPrice] = useState<number>(31000);

  // Stock Audit State (3.3)
  const [auditItems, setAuditItems] = useState<{ [key: string]: number }>({});
  const [auditSaved, setAuditSaved] = useState(false);

  // Calculate days until expiry
  const getDaysLeft = (expiryDateStr: string) => {
    const today = new Date();
    const exp = new Date(expiryDateStr);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 3.4: Filter expiring batches (< 30 days)
  const expiringBatches = batches.filter(b => {
    const days = getDaysLeft(b.expiryDate);
    return days <= 30 && b.quantity > 0;
  });

  const criticalExpiringBatches = batches.filter(b => {
    const days = getDaysLeft(b.expiryDate);
    return days <= 15 && b.quantity > 0;
  });

  const filteredBatches = batches.filter(b => {
    const product = products.find(p => p.id === b.productId);
    const matchSearch = b.batchCode.toLowerCase().includes(search.toLowerCase()) ||
                        (product && product.name.toLowerCase().includes(search.toLowerCase()));
    return matchSearch;
  });

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === selectedProductForImport);
    if (!prod) return;

    const days = getDaysLeft(expDate);
    const newBatch: Batch = {
      id: `batch-${Date.now()}`,
      batchCode,
      productId: prod.id,
      manufacturingDate: mfgDate,
      expiryDate: expDate,
      quantity: Number(importQty),
      importPrice: Number(importPrice),
      status: days < 0 ? 'expired' : days <= 30 ? 'expiring_soon' : 'good',
      receivedById: currentStaff.id
    };

    onAddBatch(newBatch);
    setShowImportModal(false);
  };

  return (
    <div className="space-y-4">
      {/* 3.4 Urgent Expiry Alert Banner */}
      {criticalExpiringBatches.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start justify-between gap-3 text-rose-900 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-100 rounded-lg text-rose-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs">
                CẢNH BÁO: Có {criticalExpiringBatches.length} lô hàng cận hạn sử dụng nguy cấp (≤ 15 ngày)!
              </h4>
              <p className="text-[11px] text-rose-700 mt-0.5">
                Đặc thù sữa thanh trùng và sữa chua tươi cần ưu tiên xuất bán gấp (FIFO) hoặc áp dụng mã giảm giá thanh lý.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('alerts')}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 transition-colors"
          >
            Xem ngay
          </button>
        </div>
      )}

      {/* Sub tabs: 3.1, 3.2, 3.3, 3.4 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            id="tab-batches"
            onClick={() => setActiveTab('batches')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'batches'
                ? 'bg-[#004885] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5" />
            <span>Tất cả lô hàng trong kho ({batches.length})</span>
          </button>
          <button
            id="tab-alerts"
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'alerts'
                ? 'bg-[#004885] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>3.4 Cảnh báo hàng cận hạn ({expiringBatches.length})</span>
          </button>
          <button
            id="tab-audit"
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'audit'
                ? 'bg-[#004885] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>3.3 Kiểm kê tồn kho</span>
          </button>
        </div>

        <button
          id="btn-open-import-batch"
          onClick={() => setShowImportModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <PlusCircle className="w-4 h-4" />
          <span>3.1 Nhập kho lô hàng mới</span>
        </button>
      </div>

      {/* 3.1 & 3.2: Batches Inventory Table */}
      {activeTab === 'batches' && (
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
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Mã Lô Hàng</th>
                  <th className="py-2.5 px-3">Sản phẩm TH True Milk</th>
                  <th className="py-2.5 px-3">Ngày sản xuất (NSX)</th>
                  <th className="py-2.5 px-3">Hạn sử dụng (HSD)</th>
                  <th className="py-2.5 px-3 text-center">Số ngày còn</th>
                  <th className="py-2.5 px-3 text-right">Số lượng tồn</th>
                  <th className="py-2.5 px-3 text-right">Giá nhập</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái hạn dùng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.map(batch => {
                  const prod = products.find(p => p.id === batch.productId);
                  const daysLeft = getDaysLeft(batch.expiryDate);

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#004885]">{batch.batchCode}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {prod?.name || 'Sản phẩm TH'}
                        <span className="block text-[10px] text-slate-400 font-normal">Mã SP: {prod?.code}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{batch.manufacturingDate}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{batch.expiryDate}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-bold ${
                          daysLeft <= 0 ? 'text-rose-600' : daysLeft <= 15 ? 'text-rose-600' : daysLeft <= 30 ? 'text-amber-600' : 'text-slate-700'
                        }`}>
                          {daysLeft > 0 ? `${daysLeft} ngày` : 'Đã hết hạn!'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {batch.quantity} {prod?.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {batch.importPrice.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          daysLeft <= 0 ? 'bg-rose-100 text-rose-800' :
                          daysLeft <= 15 ? 'bg-rose-100 text-rose-700 animate-pulse' :
                          daysLeft <= 30 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {daysLeft <= 0 ? 'Đã hết hạn' :
                           daysLeft <= 15 ? 'Nguy cấp (≤15 ngày)' :
                           daysLeft <= 30 ? 'Cận date (≤30 ngày)' : 'Đảm bảo'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3.4: Filtered Expiring Batches Table */}
      {activeTab === 'alerts' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>3.4 Danh sách lô hàng cận hạn sử dụng</span>
              </h3>
              <p className="text-xs text-slate-500">Các mặt hàng sữa và chế phẩm từ sữa có hạn sử dụng còn lại dưới 30 ngày</p>
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
                  <th className="py-2.5 px-3">Đề xuất xử lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expiringBatches.map(b => {
                  const prod = products.find(p => p.id === b.productId);
                  const days = getDaysLeft(b.expiryDate);

                  return (
                    <tr key={b.id} className="hover:bg-amber-50/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#004885]">{b.batchCode}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{prod?.name}</td>
                      <td className="py-2.5 px-3 font-bold text-rose-700">{b.expiryDate}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          days <= 15 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          Còn {days} ngày
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {b.quantity} {prod?.unit}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {days <= 15 ? (
                          <span className="text-rose-700 font-bold">⚡ Áp dụng mã giảm giá 30% xả kho ngay</span>
                        ) : (
                          <span className="text-amber-800 font-medium">Ưu tiên xếp quầy ngoài cùng (FIFO)</span>
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

      {/* 3.3: Stock Audit (Kiểm kê kho) */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">3.3 Phiếu kiểm kê tồn kho cửa hàng</h3>
              <p className="text-xs text-slate-500">Đối chiếu số lượng phần mềm hệ thống với số lượng thực tế kiểm đếm tại kệ</p>
            </div>
            {auditSaved && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã gửi phiếu kiểm kê, chờ quản lý duyệt!
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
                  <th className="py-2.5 px-3 text-right">SL Thực tế đếm được</th>
                  <th className="py-2.5 px-3 text-right">Chênh lệch</th>
                  <th className="py-2.5 px-3">Lý do điều chỉnh (nếu có)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.slice(0, 6).map(b => {
                  const prod = products.find(p => p.id === b.productId);
                  const actualCount = auditItems[b.id] !== undefined ? auditItems[b.id] : b.quantity;
                  const diff = actualCount - b.quantity;

                  return (
                    <tr key={b.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#004885]">{b.batchCode}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{prod?.name}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-600">{b.quantity}</td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          value={actualCount}
                          onChange={(e) => {
                            setAuditItems({
                              ...auditItems,
                              [b.id]: Number(e.target.value)
                            });
                          }}
                          className="w-20 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-right font-bold text-xs"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        <span className={diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {diff < 0 ? 'Bao bì móp méo / vỡ hỏng' : diff > 0 ? 'Thừa khi nhập hàng' : 'Khớp'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              onClick={() => {
                const items: StockAuditItem[] = batches.slice(0, 6).map(b => {
                  const actual = auditItems[b.id] !== undefined ? auditItems[b.id] : b.quantity;
                  const diff = actual - b.quantity;
                  return {
                    batchId: b.id,
                    productId: b.productId,
                    productName: products.find(p => p.id === b.productId)?.name || '',
                    systemQuantity: b.quantity,
                    actualQuantity: actual,
                    difference: diff,
                    reason: diff < 0 ? 'Bao bì móp méo / vỡ hỏng' : diff > 0 ? 'Thừa khi nhập hàng' : 'Khớp'
                  };
                });
                const now = new Date();
                onSubmitAudit({
                  id: `audit-${now.getTime()}`,
                  auditCode: `KK-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(10 + Math.random() * 90)}`,
                  auditDate: now.toLocaleString('vi-VN'),
                  performedById: currentStaff.id,
                  status: 'pending_approval', // chờ quản lý duyệt, tồn kho CHƯA đổi
                  items
                });
                setAuditItems({});
                setAuditSaved(true);
                setTimeout(() => setAuditSaved(false), 3000);
              }}
              className="px-4 py-2 bg-[#004885] hover:bg-[#00386b] text-white rounded-lg text-xs font-bold shadow-xs"
            >
              Gửi phiếu kiểm kê chờ quản lý duyệt
            </button>
          </div>

          {/* Danh sách phiếu kiểm kê & bước quản lý duyệt (stock_audits) */}
          {audits.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <h4 className="font-bold text-xs text-slate-900">Phiếu kiểm kê đã lập ({audits.length})</h4>
              {audits.map(a => {
                const totalDiff = a.items.reduce((acc, i) => acc + i.difference, 0);
                const statusLabel = {
                  draft: 'Nháp',
                  pending_approval: 'Chờ duyệt',
                  approved: 'Đã duyệt',
                  rejected: 'Từ chối'
                }[a.status];
                return (
                  <div key={a.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                    <div>
                      <span className="font-mono font-bold text-[#004885]">{a.auditCode}</span>
                      <span className="text-slate-500"> • {a.auditDate} • {a.items.length} dòng • Chênh lệch: {totalDiff > 0 ? `+${totalDiff}` : totalDiff}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700">{statusLabel}</span>
                      {a.status === 'pending_approval' && currentStaff.role === 'manager' && (
                        <>
                          <button
                            onClick={() => onReviewAudit(a.id, true, currentStaff.id)}
                            className="px-2 py-1 rounded bg-emerald-600 text-white font-bold"
                          >
                            Duyệt
                          </button>
                          <button
                            onClick={() => onReviewAudit(a.id, false, currentStaff.id)}
                            className="px-2 py-1 rounded bg-rose-50 text-rose-700 font-bold"
                          >
                            Từ chối
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: 3.1 Nhập kho lô hàng mới */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">3.1 Nhập kho lô hàng TH True Milk</h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Chọn sản phẩm nhập</label>
                <select
                  value={selectedProductForImport}
                  onChange={(e) => setSelectedProductForImport(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name} ({p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Mã Lô Sản Xuất (Batch Code)</label>
                <input
                  type="text"
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                  placeholder="VD: LOTH-2026-09C"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ngày sản xuất (NSX)</label>
                  <input
                    type="date"
                    value={mfgDate}
                    onChange={(e) => setMfgDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Hạn sử dụng (HSD)</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-rose-700"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Số lượng nhập</label>
                  <input
                    type="number"
                    value={importQty}
                    onChange={(e) => setImportQty(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Giá nhập (VNĐ)</label>
                  <input
                    type="number"
                    value={importPrice}
                    onChange={(e) => setImportPrice(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-xs"
                >
                  Lưu nhập kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
