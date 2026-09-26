import React from 'react';
import { Printer, X, CheckCircle, Milk, QrCode } from 'lucide-react';
import { Invoice } from '../types';

interface InvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ invoice, onClose }) => {
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header Action Bar */}
        <div className="bg-[#004885] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm">Hóa đơn thanh toán bán lẻ</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors"
              title="In hóa đơn"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div id="printable-receipt" className="p-6 text-slate-800 font-sans text-xs bg-white space-y-4">
          {/* Store Logo & Address */}
          <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-4">
            <div className="flex items-center justify-center gap-1.5 text-[#004885]">
              <Milk className="w-6 h-6" />
              <span className="text-xl font-extrabold tracking-tight">TH true mart</span>
            </div>
            <p className="font-semibold text-slate-700 text-xs">CÔNG TY CỔ PHẦN CHUỖI THỰC PHẨM TH</p>
            <p className="text-slate-500 text-[11px]">Cửa hàng: 25 Tràng Tiền, Hoàn Kiếm, Hà Nội</p>
            <p className="text-slate-500 text-[11px]">Hotline: 1800 54 54 40 - MST: 0104336888</p>
          </div>

          {/* Invoice Meta */}
          <div className="space-y-1 text-[11px] text-slate-600 border-b border-dashed border-slate-200 pb-3">
            <div className="flex justify-between">
              <span>Mã hóa đơn:</span>
              <span className="font-bold text-slate-900">{invoice.code}</span>
            </div>
            <div className="flex justify-between">
              <span>Thời gian:</span>
              <span>{invoice.createdAt}</span>
            </div>
            <div className="flex justify-between">
              <span>Thu ngân:</span>
              <span>{invoice.cashierName}</span>
            </div>
            {invoice.customerName && (
              <div className="flex justify-between text-sky-800 font-medium">
                <span>Khách hàng TH Club:</span>
                <span>{invoice.customerName} ({invoice.customerPhone})</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
            <div className="grid grid-cols-12 font-bold text-slate-700 pb-1 border-b border-slate-200">
              <span className="col-span-6">Tên sản phẩm</span>
              <span className="col-span-2 text-center">SL</span>
              <span className="col-span-4 text-right">Thành tiền</span>
            </div>

            {invoice.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 items-start py-1 border-b border-slate-100 last:border-0">
                <div className="col-span-6 pr-1">
                  <p className="font-medium text-slate-900 leading-snug">{item.productName}</p>
                  <p className="text-[10px] text-slate-500">ĐVT: {item.unit} | Lô: {item.batchCode}</p>
                </div>
                <div className="col-span-2 text-center font-medium pt-0.5">
                  {item.quantity}
                </div>
                <div className="col-span-4 text-right font-medium text-slate-900 pt-0.5">
                  {item.subtotal.toLocaleString('vi-VN')} đ
                </div>
              </div>
            ))}
          </div>

          {/* Totals Calculation */}
          <div className="space-y-1.5 text-xs text-slate-700">
            <div className="flex justify-between">
              <span>Tổng tiền hàng:</span>
              <span>{invoice.subtotal.toLocaleString('vi-VN')} đ</span>
            </div>

            {invoice.discountAmount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Giảm giá {invoice.voucherCode ? `(${invoice.voucherCode})` : ''}:</span>
                <span>-{invoice.discountAmount.toLocaleString('vi-VN')} đ</span>
              </div>
            )}

            {invoice.pointsUsed > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Đổi điểm TH Point ({invoice.pointsUsed} điểm):</span>
                <span>-{(invoice.pointsUsed * 1000).toLocaleString('vi-VN')} đ</span>
              </div>
            )}

            <div className="flex justify-between text-base font-extrabold text-[#004885] pt-1 border-t border-slate-300">
              <span>TỔNG THANH TOÁN:</span>
              <span>{invoice.finalTotal.toLocaleString('vi-VN')} đ</span>
            </div>

            <div className="flex justify-between text-[11px] text-slate-500 pt-1">
              <span>Hình thức thanh toán:</span>
              <span className="capitalize font-medium text-slate-700">
                {invoice.paymentMethod === 'cash' ? 'Tiền mặt' : invoice.paymentMethod === 'transfer' ? 'Chuyển khoản VietQR' : 'Thẻ ngân hàng'}
              </span>
            </div>

            {invoice.paymentMethod === 'cash' && (
              <>
                <div className="flex justify-between text-[11px]">
                  <span>Tiền khách đưa:</span>
                  <span>{invoice.receivedAmount.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-emerald-700">
                  <span>Tiền thừa trả lại:</span>
                  <span>{invoice.changeAmount.toLocaleString('vi-VN')} đ</span>
                </div>
              </>
            )}

            {invoice.pointsEarned > 0 && (
              <div className="bg-sky-50 p-2 rounded text-sky-800 text-[11px] font-medium text-center mt-2 border border-sky-100">
                ⭐ Tích lũy thêm +{invoice.pointsEarned} True Point cho lần mua sau!
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="text-center space-y-1 text-slate-400 text-[10px] pt-2">
            <p>Cảm ơn Quý khách đã tin chọn sản phẩm Tươi - Sạch của TH true mart!</p>
            <p>Hàng đổi trả trong vòng 24h đối với sữa tươi bảo quản lạnh kèm hóa đơn.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Đóng
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#004885] hover:bg-[#00386b] text-white flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>In hóa đơn</span>
          </button>
        </div>
      </div>
    </div>
  );
};
