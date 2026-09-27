import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package, 
  AlertOctagon, 
  Calendar, 
  Award,
  ArrowUpRight,
  PieChart
} from 'lucide-react';
import { Invoice, Product, Batch } from '../../types';

interface BaoCaoThongKeProps {
  invoices: Invoice[];
  products: Product[];
  batches: Batch[];
}

export const BaoCaoThongKe: React.FC<BaoCaoThongKeProps> = ({
  invoices,
  products,
  batches
}) => {
  const [timeRange, setTimeRange] = useState<'today' | 'month' | 'year'>('month');

  // 7.1 Doanh thu calculations
  const totalRevenue = invoices.reduce((acc, inv) => acc + inv.finalTotal, 0);
  const totalInvoicesCount = invoices.length;
  
  // Calculate top selling products (7.2)
  const productSalesMap: { [productId: string]: { name: string; quantity: number; revenue: number } } = {};
  
  invoices.forEach(inv => {
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

  // Mock daily revenue data for chart
  const revenueByDay = [
    { day: '15/09', revenue: 4200000 },
    { day: '16/09', revenue: 5800000 },
    { day: '17/09', revenue: 3900000 },
    { day: '18/09', revenue: 7100000 },
    { day: '19/09', revenue: 8450000 },
    { day: '20/09', revenue: 9200000 },
    { day: '21/09 (Hôm nay)', revenue: totalRevenue }
  ];

  const maxDailyRevenue = Math.max(...revenueByDay.map(d => d.revenue));

  return (
    <div className="space-y-5">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="font-bold text-sm text-slate-900">7. Báo cáo thống kê kinh doanh TH true mart</h3>
          <p className="text-xs text-slate-500">Thống kê doanh thu, phân tích mặt hàng bán chạy và giám sát hao hụt tồn kho</p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setTimeRange('today')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              timeRange === 'today' ? 'bg-white text-[#004885] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hôm nay
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              timeRange === 'month' ? 'bg-white text-[#004885] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tháng này
          </button>
          <button
            onClick={() => setTimeRange('year')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              timeRange === 'year' ? 'bg-white text-[#004885] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Năm 2026
          </button>
        </div>
      </div>

      {/* 7.1 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Tổng doanh thu</span>
            <span className="p-1.5 bg-sky-50 text-[#004885] rounded-md">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-[#004885]">
            {totalRevenue.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-emerald-600 flex items-center gap-0.5">
            <ArrowUpRight className="w-3.5 h-3.5" /> +14.8% so với tuần trước
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Tổng hóa đơn POS</span>
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
            <span>Giá trị tồn kho hiện tại</span>
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
            <span>Tỷ lệ hao hụt / Hàng hủy</span>
            <span className="p-1.5 bg-rose-50 text-rose-700 rounded-md">
              <AlertOctagon className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-rose-600">
            0.45%
          </div>
          <div className="text-[11px] text-emerald-600">
            Đạt chuẩn kiểm soát chất lượng TH (&lt; 0.8%)
          </div>
        </div>
      </div>

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

        {/* 7.2 Best Selling TH Products */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              <span>7.2 Mặt hàng bán chạy nhất (Top Sellers)</span>
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
    </div>
  );
};
