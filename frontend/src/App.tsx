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
import {
  INITIAL_BATCHES,
  INITIAL_STAFF,
  INITIAL_PROMOTIONS,
  INITIAL_INVOICES,
  INITIAL_PURCHASE_ORDERS,
} from "./data/initialData";
import {
  Batch,
  Staff,
  Promotion,
  Invoice,
  InvoiceApproval,
  PurchaseOrder,
  StockAudit,
} from "./types";
import { useSuppliers } from "./hooks/useSuppliers";
import { useProducts } from "./hooks/useProducts";

export default function App() {
  const [activeModule, setActiveModule] = useState<number>(1); // 1 to 6

  // ===== Dữ liệu đã nối API: state + gọi API nằm trong hook =====
  const { suppliers, addSupplier, updateSupplier, removeSupplier } =
    useSuppliers();
  const { products, addProduct, updateProductPrice } = useProducts();

  // ===== Dữ liệu tạm (dữ liệu giả, sẽ nối API ở các module sau) =====
  const [batches, setBatches] = useState<Batch[]>(INITIAL_BATCHES);
  const [staffList, setStaffList] = useState<Staff[]>(INITIAL_STAFF);
  const [promotions, setPromotions] = useState<Promotion[]>(INITIAL_PROMOTIONS);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(
    INITIAL_PURCHASE_ORDERS,
  );
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
  // 1. Transaction handler: POS completed invoice -> deduct batch (FIFO)
  const handleCreateInvoice = (newInvoice: Invoice) => {
    setInvoices((prev) => [newInvoice, ...prev]);

    // FIFO inventory deduction
    setBatches((prevBatches) => {
      const updated = [...prevBatches];
      newInvoice.items.forEach((cartItem) => {
        let remainingToDeduct = cartItem.quantity;
        // find batches for this product sorted by expiryDate ascending (FIFO)
        const relevantBatches = updated
          .filter((b) => b.productId === cartItem.productId && b.quantity > 0)
          .sort(
            (a, b) =>
              new Date(a.expiryDate).getTime() -
              new Date(b.expiryDate).getTime(),
          );

        for (const b of relevantBatches) {
          if (remainingToDeduct <= 0) break;
          if (b.quantity >= remainingToDeduct) {
            b.quantity -= remainingToDeduct;
            remainingToDeduct = 0;
          } else {
            remainingToDeduct -= b.quantity;
            b.quantity = 0;
          }
        }
      });
      return updated;
    });
  };

  // Đổi trả / hủy hóa đơn: quản lý duyệt (invoice_approvals) + hoàn tồn kho
  type ApprovalInput = Omit<InvoiceApproval, "id" | "createdAt" | "action">;

  const restoreStock = (invoice: Invoice) => {
    setBatches((prev) =>
      prev.map((b) => {
        const item = invoice.items.find((i) =>
          i.batchId ? i.batchId === b.id : i.productId === b.productId,
        );
        return item ? { ...b, quantity: b.quantity + item.quantity } : b;
      }),
    );
  };

  const applyApproval = (
    invoiceId: string,
    action: "return" | "cancel",
    input: ApprovalInput,
  ) => {
    const target = invoices.find((inv) => inv.id === invoiceId);
    if (!target) return;
    const approval: InvoiceApproval = {
      ...input,
      id: `appr-${Date.now()}`,
      action,
      createdAt: new Date().toLocaleString("vi-VN"),
    };
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              status: action === "return" ? "returned" : "cancelled",
              approvals: [...(inv.approvals || []), approval],
              notes: `${inv.notes || ""} [${action === "return" ? "Đã trả hàng" : "Đã hủy"}: ${input.reason}]`,
            }
          : inv,
      ),
    );
    restoreStock(target);
  };

  const handleReturnInvoice = (invoiceId: string, input: ApprovalInput) =>
    applyApproval(invoiceId, "return", input);
  const handleCancelInvoice = (invoiceId: string, input: ApprovalInput) =>
    applyApproval(invoiceId, "cancel", input);

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

  // 4. Staff handlers
  const handleAddStaff = (newStaff: Staff) => {
    setStaffList((prev) => [...prev, newStaff]);
  };

  const handleUpdateShift = (staffId: string, newShift: Staff["shift"]) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, shift: newShift } : s)),
    );
  };

  const handleCreatePurchaseOrder = (newPO: PurchaseOrder) => {
    setPurchaseOrders((prev) => [newPO, ...prev]);
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
                      promotions={promotions}
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
                      onAddStaff={handleAddStaff}
                      onUpdateShift={handleUpdateShift}
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
                      onCreatePurchaseOrder={handleCreatePurchaseOrder}
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
