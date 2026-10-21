import { useState } from "react";
import { Navbar } from "./components/Navbar";
import { BanHangPOS } from "./components/pos/BanHangPOS";
import { QuanLyHangHoa } from "./components/products/QuanLyHangHoa";
import { QuanLyKho } from "./components/inventory/QuanLyKho";
import { QuanLyNhanVien } from "./components/staff/QuanLyNhanVien";
import { QuanLyNhaCungCap } from "./components/suppliers/QuanLyNhaCungCap";
import { BaoCaoThongKe } from "./components/reports/BaoCaoThongKe";
import { INITIAL_STAFF } from "./data/initialData";
import { Staff } from "./types";
import type { CreateInvoiceInput } from "./types/api";
import { useProducts } from "./hooks/useProducts";
import { useBatches } from "./hooks/useBatches";
import { usePromotions } from "./hooks/usePromotions";
import { useInvoices } from "./hooks/useInvoices";
import { canAccessModule } from "./lib/permissions";

export default function App() {
  const [activeModule, setActiveModule] = useState<number>(1); // 1 to 6

  // ===== Dữ liệu đã nối API: state + gọi API nằm trong hook =====
  const { products, addProduct, updateProductPrice } = useProducts();

  // Lô hàng lấy từ DB, dùng chung cho Navbar, Kho, POS, Báo cáo
  const { batches, reload: reloadBatches } = useBatches();

  // ===== Dữ liệu tạm (dữ liệu giả, sẽ nối API ở các module sau) =====
  const [staffList, setStaffList] = useState<Staff[]>(INITIAL_STAFF);
  // Khuyến mãi lấy từ DB (/api/promotions)
  const {
    promotions,
    createPromotion,
    changePromotionStatus,
    reload: reloadPromotions,
  } = usePromotions();
  const { invoices, previewInvoice, createInvoice } = useInvoices();

  // Nhân viên đang thao tác. TODO: thay bằng tài khoản đăng nhập (auth_sessions) khi có màn hình đăng nhập.
  const currentStaff: Staff =
    staffList.find((s) => s.role === "manager" && s.status === "active") ||
    staffList[0];

  // Không chỉ ẩn link: mọi đường dẫn đổi module cũng phải qua kiểm tra quyền.
  const visibleActiveModule = canAccessModule(currentStaff.role, activeModule)
    ? activeModule
    : 1;
  const handleSetActiveModule = (moduleId: number) => {
    if (canAccessModule(currentStaff.role, moduleId)) {
      setActiveModule(moduleId);
    }
  };

  // Expiring Batches calculation for urgent badge in Navbar
  const getDaysLeft = (expiryDateStr: string) => {
    const today = new Date();
    const exp = new Date(expiryDateStr);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const expiringCount = batches.filter((b) => {
    const days = getDaysLeft(b.expiryDate);
    return days <= 30 && b.quantity > 0;
  }).length;

  const handleCreateInvoice = async (input: CreateInvoiceInput) => {
    const invoice = await createInvoice(input);
    await Promise.all([reloadBatches(), reloadPromotions()]);
    return invoice;
  };

  // Kiểm kê: đã chuyển sang gọi API trực tiếp trong QuanLyKho (/api/stock-audits)

  // 4. Staff handlers
  const handleAddStaff = (newStaff: Staff) => {
    setStaffList((prev) => [...prev, newStaff]);
  };

  const handleUpdateShift = (staffId: string, newShift: Staff["shift"]) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, shift: newShift } : s)),
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Main Navigation Bar with 6 modules */}
      <Navbar
        activeModule={visibleActiveModule}
        setActiveModule={handleSetActiveModule}
        expiringCount={expiringCount}
        role={currentStaff.role}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        <div>
          {visibleActiveModule === 1 && (
            <BanHangPOS
              products={products}
              batches={batches}
              invoices={invoices}
              onPreviewInvoice={previewInvoice}
              onCreateInvoice={handleCreateInvoice}
            />
          )}

          {visibleActiveModule === 2 && (
            <QuanLyHangHoa
              products={products}
              promotions={promotions}
              onUpdateProductPrice={updateProductPrice}
              onAddProduct={addProduct}
              onCreatePromotion={createPromotion}
              onChangePromotionStatus={changePromotionStatus}
            />
          )}

          {visibleActiveModule === 3 && (
            <QuanLyKho
              products={products}
              batches={batches}
              reloadBatches={reloadBatches}
              currentStaff={currentStaff}
            />
          )}

          {visibleActiveModule === 4 && (
            <QuanLyNhanVien
              staffList={staffList}
              onAddStaff={handleAddStaff}
              onUpdateShift={handleUpdateShift}
            />
          )}

          {visibleActiveModule === 5 && <QuanLyNhaCungCap products={products} />}

          {visibleActiveModule === 6 && (
            <BaoCaoThongKe
              invoices={invoices}
              products={products}
              batches={batches}
            />
          )}
        </div>
      </main>
    </div>
  );
}
