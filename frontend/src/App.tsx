import { useState } from "react";
import { Navbar } from "./components/Navbar";
import { BanHangPOS } from "./components/pos/BanHangPOS";
import { QuanLyHangHoa } from "./components/products/QuanLyHangHoa";
import { QuanLyKho } from "./components/inventory/QuanLyKho";
import { QuanLyNhanVien } from "./components/staff/QuanLyNhanVien";
import { QuanLyNhaCungCap } from "./components/suppliers/QuanLyNhaCungCap";
import { BaoCaoThongKe } from "./components/reports/BaoCaoThongKe";
import { LoginModal } from "./components/auth/LoginModal";
import { Staff } from "./types";
import type { CreateInvoiceInput } from "./types/api";
import { useProducts } from "./hooks/useProducts";
import { useBatches } from "./hooks/useBatches";
import { usePromotions } from "./hooks/usePromotions";
import { useInvoices } from "./hooks/useInvoices";
import { canAccessModule } from "./lib/permissions";
import { useRoleGroups } from "./hooks/useRoleGroups";
import { useStaff } from "./hooks/useStaff";
import { authService, AuthStaff } from "./services/auth";

export default function App() {
  const [activeModule, setActiveModule] = useState<number>(1); // 1 to 6
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // Quản lý phiên làm việc & tài khoản đăng nhập thời gian thực (UC23, UC24)
  const [currentUser, setCurrentUser] = useState<AuthStaff | null>(() => {
    return authService.getCurrentUser();
  });

  const [userPermissions, setUserPermissions] = useState<string[] | null>(() => {
    return authService.getSavedPermissions();
  });

  // ===== Dữ liệu đã nối API: state + gọi API nằm trong hook =====
  const { products, addProduct, updateProduct, updateProductPrice } = useProducts();
  const { batches, reload: reloadBatches } = useBatches();
  const { roles, permissions, error: roleLoadError, reload: reloadRoles } = useRoleGroups();
  const {
    staffList,
    loginLogs,
    isLoading: isStaffLoading,
    addStaff,
    toggleLock,
    reloadStaff,
  } = useStaff();

  const {
    promotions,
    createPromotion,
    changePromotionStatus,
    reload: reloadPromotions,
  } = usePromotions();
  const { invoices, previewInvoice, createInvoice } = useInvoices();

  const handleLoginSuccess = (staff: AuthStaff, perms: string[]) => {
    setCurrentUser(staff);
    setUserPermissions(perms);
    setShowLoginModal(false);
    const allowed = [1, 2, 3, 4, 5, 6].find((m) => canAccessModule(perms, m)) ?? 1;
    setActiveModule(allowed);
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setUserPermissions(null);
    setShowLoginModal(false);
  };

  // Nếu chưa đăng nhập, bắt buộc phải đăng nhập (không fix cứng tài khoản)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#002a50] via-[#004885] to-slate-900 flex flex-col justify-center items-center p-4">
        <LoginModal
          isOpen={true}
          isDismissible={false}
          onClose={() => {}}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  const currentStaff: Staff = {
    id: currentUser.id,
    code: currentUser.code,
    name: currentUser.name,
    phone: currentUser.phone || "",
    username: currentUser.username,
    role: (currentUser.role as any) || "manager",
    status: "active",
    shift: "HANH_CHINH",
  };

  // Xác định quyền hạn theo role hiện tại của nhân viên đã đăng nhập
  const rolePermissions = userPermissions ?? (roles === null
    ? null
    : roles.find((role) => role.code === currentStaff.role)?.role_permissions.map(
        (link) => link.permissions.code,
      ) ?? []);

  const firstAllowedModule = [1, 2, 3, 4, 5, 6].find((moduleId) =>
    canAccessModule(rolePermissions, moduleId),
  );

  const visibleActiveModule = canAccessModule(rolePermissions, activeModule)
    ? activeModule
    : firstAllowedModule ?? 1;

  const handleSetActiveModule = (moduleId: number) => {
    if (canAccessModule(rolePermissions, moduleId)) {
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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Main Navigation Bar with 6 modules */}
      <Navbar
        activeModule={visibleActiveModule}
        setActiveModule={handleSetActiveModule}
        expiringCount={expiringCount}
        permissionCodes={rolePermissions}
        currentStaff={currentUser}
        onOpenLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
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
              onUpdateProduct={updateProduct}
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
              loginLogs={loginLogs}
              isLoading={isStaffLoading}
              onAddStaff={addStaff}
              onToggleLock={toggleLock}
              roles={roles}
              permissions={permissions}
              roleLoadError={roleLoadError}
              reloadRoles={reloadRoles}
              reloadStaff={reloadStaff}
            />
          )}

          {visibleActiveModule === 5 && <QuanLyNhaCungCap products={products} />}

          {visibleActiveModule === 6 && (
            <BaoCaoThongKe
              invoices={invoices}
              products={products}
              batches={batches}
              promotions={promotions}
            />
          )}
        </div>
      </main>

      {/* Modal Đăng nhập / Chuyển đổi vai trò khi đang trong phiên */}
      <LoginModal
        isOpen={showLoginModal}
        isDismissible={true}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
