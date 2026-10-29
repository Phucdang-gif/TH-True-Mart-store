import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package, 
  AlertOctagon, 
  Award, 
  ArrowUpRight, 
  Tag,
  CheckCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { Invoice, Product, Batch, Promotion } from '../../types';
import { PROMOTION_SCOPE_LABELS, PROMOTION_STATUS_LABELS } from '../../lib/labels';

interface BaoCaoThongKeProps {
  invoices: Invoice[];
  products: Product[];
  batches: Batch[];
  promotions?: Promotion[];
}

export const BaoCaoThongKe: React.FC<BaoCaoThongKeProps> = ({
  invoices,
  products,
  batches,
  promotions = [],
}) => {
  const [timeRange, setTimeRange] = useState<'today' | 'month' | 'year'>('month');

  // 7.1 Doanh thu calculations
  const completedInvoices = invoices.filter(inv => inv.status === 'completed');
  const totalRevenue = completedInvoices.reduce((acc, inv) => acc + inv.finalTotal, 0);
  const totalDiscountGiven = completedInvoices.reduce((acc, inv) => acc + inv.discountAmount, 0);
  const totalInvoicesCount = completedInvoices.length;
  
  // 7.4 Calculate top selling products (Top Sellers)
  const productSalesMap: { [productId: string]: { name: string; quantity: number; revenue: number } } = {};
  
  completedInvoices.forEach(inv => {
    inv.items.forEach(item => {
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = {
          name: item.productName,
          quantity: 0,
          revenue: 0
        };
      }
      productSalesMap[item.productId].quantity += item.quantity;
      productSalesMap[item.productId].revenue += item.subtotal;
    });
  });

  const bestSellers = Object.values(productSalesMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // 7.3 Inventory Value & Expired/Risk Calculation
  const totalInventoryValue = batches.reduce((acc, b) => acc + (b.quantity * b.importPrice), 0);
  const totalStockUnits = batches.reduce((acc, b) => acc + b.quantity, 0);

  // 7.1 Tính toán doanh thu thực tế theo ngày từ các hóa đơn đã hoàn tất trong CSDL
  const dayRevenueMap: { [dateKey: string]: number } = {};
  completedInvoices.forEach((inv) => {
    if (inv.createdAt) {
      const d = new Date(inv.createdAt);
      const dateKey = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      dayRevenueMap[dateKey] = (dayRevenueMap[dateKey] || 0) + inv.finalTotal;
    }
  });

  // Tạo chuỗi 7 ngày gần nhất tính đến hôm nay
  const last7Days: { day: string; revenue: number }[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateKey = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    const dayLabel = i === 0 ? `${dateKey} (Hôm nay)` : dateKey;
    last7Days.push({
      day: dayLabel,
      revenue: dayRevenueMap[dateKey] || 0,
    });
  }

  const revenueByDay = last7Days;
  const maxDailyRevenue = Math.max(...revenueByDay.map((d) => d.revenue), 1000000);

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="font-bold text-sm text-slate-900">7. Báo cáo thống kê kinh doanh TH true mart</h3>
          <p className="text-xs text-slate-500">Thống kê doanh thu, hiệu quả khuyến mãi, tồn kho và mặt hàng bán chạy (BFD 7.1 - 7.4)</p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setTimeRange('today')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              timeRange === 'today' ? 'bg-white text-[#004885] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hôm nay
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              timeRange === 'month' ? 'bg-white text-[#004885] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tháng này
          </button>
          <button
            onClick={() => setTimeRange('year')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              timeRange === 'year' ? 'bg-white text-[#004885] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Năm 2026
          </button>
        </div>
      </div>

      {/* KPI Summary Cards (7.1 & 7.3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>7.1 Tổng doanh thu thực tế</span>
            <span className="p-1.5 bg-sky-50 text-[#004885] rounded-md">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-[#004885]">
            {totalRevenue.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-emerald-600 flex items-center gap-0.5">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>
              {totalInvoicesCount > 0
                ? `${totalInvoicesCount} giao dịch bán hàng đã ghi nhận`
                : "Chưa có giao dịch"}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Tổng hóa đơn đã bán</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-md">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-slate-900">
            {totalInvoicesCount} đơn
          </div>
          <div className="text-[11px] text-slate-500">
            Giá trị trung bình: {Math.round(totalRevenue / (totalInvoicesCount || 1)).toLocaleString('vi-VN')} đ/đơn
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>7.3 Giá trị tồn kho hiện tại</span>
            <span className="p-1.5 bg-amber-50 text-amber-700 rounded-md">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-amber-800">
            {totalInventoryValue.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-slate-500">
            Tổng cộng: {totalStockUnits} sản phẩm trong kho
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>7.2 Tổng ưu đãi đã giảm</span>
            <span className="p-1.5 bg-rose-50 text-rose-700 rounded-md">
              <Tag className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-rose-600">
            {totalDiscountGiven.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-slate-500">
            Ưu đãi từ các chương trình KM & Voucher
          </div>
        </div>
      </div>

      {/* Row: 7.1 Daily Revenue Chart & 7.4 Best Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 7.1 Visual Bar Chart of Daily Revenue */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-[#004885]" />
              <span>7.1 Biểu đồ biến động doanh thu 7 ngày gần nhất</span>
            </h4>
            <span className="text-[11px] text-slate-500">Đơn vị: VNĐ</span>
          </div>

          <div className="h-56 flex items-end justify-between gap-3 pt-8 pb-2 px-2">
            {revenueByDay.map((item, idx) => {
              const heightPercent = Math.round((item.revenue / maxDailyRevenue) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className="text-[10px] font-bold text-[#004885] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {(item.revenue / 1000000).toFixed(1)}Tr
                  </span>
                  <div className="w-full bg-slate-100 rounded-t-lg h-44 flex items-end p-1">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-md transition-all ${
                        idx === revenueByDay.length - 1 ? 'bg-[#004885]' : 'bg-sky-500 group-hover:bg-sky-600'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 truncate w-full text-center">
                    {item.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7.4 Best Selling TH Products */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              <span>7.4 Sản phẩm bán chạy nhất (Top Sellers)</span>
            </h4>
            <span className="text-[11px] text-slate-400">Theo sản lượng</span>
          </div>

          <div className="space-y-3">
            {bestSellers.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">Chưa có giao dịch bán hàng.</p>
            ) : (
              bestSellers.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                      index === 0 ? 'bg-amber-100 text-amber-800' :
                      index === 1 ? 'bg-slate-200 text-slate-800' :
                      index === 2 ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <h5 className="font-semibold text-slate-900 truncate max-w-[180px]">{item.name}</h5>
                      <span className="text-[10px] text-slate-400">Đã bán: <strong className="text-slate-700">{item.quantity}</strong></span>
                    </div>
                  </div>
                  <div className="text-right font-bold text-[#004885]">
                    {item.revenue.toLocaleString('vi-VN')} đ
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 7.2 Báo cáo Hiệu quả Khuyến mãi (BFD 7.2 & UC28) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>7.2 Báo cáo hiệu quả các chương trình khuyến mãi & mã giảm giá</span>
            </h4>
            <p className="text-[11px] text-slate-500">Đánh giá lượt sử dụng và hiệu quả kích cầu bán hàng của từng chương trình (UC28)</p>
          </div>
          <span className="text-xs text-slate-500 font-medium">Tổng cộng: {promotions.length} chương trình</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-3">Mã KM</th>
                <th className="py-2.5 px-3">Tên chương trình</th>
                <th className="py-2.5 px-3">Phạm vi áp dụng</th>
                <th className="py-2.5 px-3">Mức giảm</th>
                <th className="py-2.5 px-3 text-center">Đã sử dụng</th>
                <th className="py-2.5 px-3 text-center">Giới hạn</th>
                <th className="py-2.5 px-3 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {promotions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Chưa có chương trình khuyến mãi nào được tạo.
                  </td>
                </tr>
              ) : (
                promotions.map((promo) => (
                  <tr key={promo.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#004885]">
                      {promo.code}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {promo.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {PROMOTION_SCOPE_LABELS[promo.scope] || promo.scope}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-700">
                      {promo.discountType === 'percentage'
                        ? `${promo.value}%`
                        : `${promo.value.toLocaleString('vi-VN')} đ`}
                      {promo.maxDiscountAmount && (
                        <span className="block text-[10px] text-slate-400 font-normal">
                          (Tối đa: {promo.maxDiscountAmount.toLocaleString('vi-VN')} đ)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                      {promo.usedCount || 0} lượt
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-500">
                      {promo.usageLimit ? `${promo.usageLimit} lượt` : 'Không giới hạn'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        promo.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : promo.status === 'paused'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {PROMOTION_STATUS_LABELS[promo.status] || promo.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
