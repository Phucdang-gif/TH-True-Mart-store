import { useState } from "react";
import { Navbar } from "./components/Navbar";
import { BanHangPOS } from "./components/pos/BanHangPOS";
import { QuanLyHangHoa } from "./components/products/QuanLyHangHoa";
import { QuanLyKho } from "./components/inventory/QuanLyKho";
import { QuanLyNhanVien } from "./components/staff/QuanLyNhanVien";
import { QuanLyNhaCungCap } from "./components/suppliers/QuanLyNhaCungCap";
import { BaoCaoThongKe } from "./components/reports/BaoCaoThongKe";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/login/Login";
import { INITIAL_PROMOTIONS } from "./data/initialData";
import { Batch, Staff, Promotion, PurchaseOrder, StockAudit } from "./types";
import type {
  ApprovalPayload,
  CreateInvoicePayload,
} from "./services/invoices";
import { useSuppliers } from "./hooks/useSuppliers";
import { useProducts } from "./hooks/useProducts";
import { useStaff } from "./hooks/useStaff";
import { usePurchaseOrders } from "./hooks/usePurchaseOrders";
import { useBatches } from "./hooks/useBatches";
import { useInvoices } from "./hooks/useInvoices";

export default function App() {
  const [activeModule, setActiveModule] = useState<number>(1); // 1 to 6

  // ===== Dữ liệu đã nối API: state + gọi API nằm trong hook =====
  const { suppliers, addSupplier, updateSupplier, removeSupplier } =
    useSuppliers();
  const { products, addProduct, updateProductPrice } = useProducts();
  const { staffList, addStaff, updateShift, removeStaff, changePassword } =
    useStaff();
  const {
    purchaseOrders,
    addPurchaseOrder,
    updatePurchaseOrderStatus,
    removePurchaseOrder,
  } = usePurchaseOrders();
  // Lô hàng + hóa đơn đã nối API (bán hàng / đổi trả trừ và hoàn kho thật trên server)
  const {
    batches,
    setBatches,
    refresh: refreshBatches,
  } = useBatches();
  const { invoices, createInvoice, returnInvoice, cancelInvoice } =
    useInvoices();

  // ===== Dữ liệu tạm (dữ liệu giả, sẽ nối API ở các module sau) =====
  const [promotions, setPromotions] = useState<Promotion[]>(INITIAL_PROMOTIONS);
  const [stockAudits, setStockAudits] = useState<StockAudit[]>([]);

  // Nhân viên đang thao tác. TODO: thay bằng tài khoản đăng nhập (auth_sessions) khi có màn hình đăng nhập.
  // Đã xử lý TODO: Lấy thông tin tài khoản đang đăng nhập thật từ localStorage
  const userStr = localStorage.getItem("user_info");
  const currentStaff = userStr ? JSON.parse(userStr) : staffList[0];

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

  // Handlers
  // 1. Bán hàng / đổi trả: server lập hóa đơn, trừ hoặc hoàn tồn kho theo lô, ghi thanh toán.
  // Sau mỗi thao tác tải lại lô hàng để màn hình thấy tồn kho mới.
  const handleCreateInvoice = async (payload: CreateInvoicePayload) => {
    const created = await createInvoice(payload);
    await refreshBatches().catch(() => {});
    return created;
  };

  const handleReturnInvoice = async (id: string, input: ApprovalPayload) => {
    await returnInvoice(id, input);
    await refreshBatches().catch(() => {});
  };

  const handleCancelInvoice = async (id: string, input: ApprovalPayload) => {
    await cancelInvoice(id, input);
    await refreshBatches().catch(() => {});
  };

  // 2. Promotion handler (TODO: nối API khi làm module khuyến mãi)
  const handleAddPromotion = (newPromo: Promotion) => {
    setPromotions((prev) => [...prev, newPromo]);
  };

  // 3. Inventory handlers
  const handleAddBatch = (newBatch: Batch) => {
    setBatches((prev) => [newBatch, ...prev]);
  };

  const handleAdjustStock = (batchId: string, newQuantity: number) => {
    setBatches((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, quantity: newQuantity } : b)),
    );
  };

  // Kiểm kê: lập phiếu -> chờ quản lý duyệt -> khi duyệt mới cập nhật tồn kho theo số thực tế
  const handleSubmitAudit = (audit: StockAudit) => {
    setStockAudits((prev) => [audit, ...prev]);
  };

  const handleReviewAudit = (
    auditId: string,
    approved: boolean,
    approverId: string,
  ) => {
    const audit = stockAudits.find((x) => x.id === auditId);
    if (!audit || audit.status !== "pending_approval") return;
    setStockAudits((prev) =>
      prev.map((x) =>
        x.id === auditId
          ? {
              ...x,
              status: approved ? "approved" : "rejected",
              approvedById: approverId,
            }
          : x,
      ),
    );
    if (approved) {
      setBatches((prev) =>
        prev.map((b) => {
          const line = audit.items.find((i) => i.batchId === b.id);
          return line ? { ...b, quantity: line.actualQuantity } : b;
        }),
      );
    }
  };

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      // Nếu chưa có token, tự động chuyển hướng (đá) về trang login
      return <Navigate to="/login" replace />;
    }
    // Nếu có token rồi thì cho phép hiển thị nội dung bên trong
    return children;
  };
  return (
    <Routes>
      {/* Route không cần bảo vệ */}
      <Route path="/login" element={<Login />} />

      {/* Route CẦN bảo vệ */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <div className="flex flex-col min-h-screen font-sans bg-slate-100 text-slate-800">
              <Navbar
                activeModule={activeModule}
                setActiveModule={setActiveModule}
                expiringCount={expiringCount}
              />

              <main className="flex-1 w-full max-w-7xl p-4 mx-auto sm:p-6">
                <div>
                  {activeModule === 1 && (
                    <BanHangPOS
                      products={products}
                      batches={batches}
                      currentStaff={currentStaff}
                      invoices={invoices}
                      onCompleteSale={handleCreateInvoice}
                      onReturnInvoice={handleReturnInvoice}
                      onCancelInvoice={handleCancelInvoice}
                    />
                  )}

                  {activeModule === 2 && (
                    <QuanLyHangHoa
                      products={products}
                      promotions={promotions}
                      onUpdateProductPrice={updateProductPrice}
                      onAddProduct={addProduct}
                      onAddPromotion={handleAddPromotion}
                    />
                  )}

                  {activeModule === 3 && (
                    <QuanLyKho
                      products={products}
                      batches={batches}
                      onAddBatch={handleAddBatch}
                      onAdjustStock={handleAdjustStock}
                      currentStaff={currentStaff}
                      audits={stockAudits}
                      onSubmitAudit={handleSubmitAudit}
                      onReviewAudit={handleReviewAudit}
                    />
                  )}

                  {activeModule === 4 && (
                    <QuanLyNhanVien
                      staffList={staffList}
                      onAddStaff={addStaff}
                      onUpdateShift={updateShift}
                      onDeleteStaff={removeStaff}
                      onChangePassword={changePassword}
                    />
                  )}

                  {activeModule === 5 && (
                    <QuanLyNhaCungCap
                      suppliers={suppliers}
                      products={products}
                      purchaseOrders={purchaseOrders}
                      onAddSupplier={addSupplier}
                      onUpdateSupplier={updateSupplier}
                      onDeleteSupplier={removeSupplier}
                      onCreatePurchaseOrder={addPurchaseOrder}
                      onUpdatePurchaseOrderStatus={updatePurchaseOrderStatus}
                      onDeletePurchaseOrder={removePurchaseOrder}
                    />
                  )}

                  {activeModule === 6 && (
                    <BaoCaoThongKe
                      invoices={invoices}
                      products={products}
                      batches={batches}
                    />
                  )}
                </div>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
