import { useState } from "react";
import { Navbar } from "./components/Navbar";
import { BanHangPOS } from "./components/pos/BanHangPOS";
import { QuanLyHangHoa } from "./components/products/QuanLyHangHoa";
import { QuanLyKho } from "./components/inventory/QuanLyKho";
import { QuanLyNhanVien } from "./components/staff/QuanLyNhanVien";
import { QuanLyNhaCungCap } from "./components/suppliers/QuanLyNhaCungCap";
import { BaoCaoThongKe } from "./components/reports/BaoCaoThongKe";
import { INITIAL_STAFF, INITIAL_INVOICES } from "./data/initialData";
import { Staff, Invoice, InvoiceApproval } from "./types";
import { useProducts } from "./hooks/useProducts";
import { useBatches } from "./hooks/useBatches";
import { usePromotions } from "./hooks/usePromotions";

export default function App() {
  const [activeModule, setActiveModule] = useState<number>(1); // 1 to 6

  // ===== Dữ liệu đã nối API: state + gọi API nằm trong hook =====
  const { products, addProduct, updateProductPrice } = useProducts();

  // Lô hàng lấy từ DB, dùng chung cho Navbar, Kho, POS, Báo cáo
  const { batches, setBatches, reload: reloadBatches } = useBatches();

  // ===== Dữ liệu tạm (dữ liệu giả, sẽ nối API ở các module sau) =====
  const [staffList, setStaffList] = useState<Staff[]>(INITIAL_STAFF);
  // Khuyến mãi lấy từ DB (/api/promotions)
  const { promotions, createPromotion, changePromotionStatus } =
    usePromotions();
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);

  // Nhân viên đang thao tác. TODO: thay bằng tài khoản đăng nhập (auth_sessions) khi có màn hình đăng nhập.
  const currentStaff: Staff =
    staffList.find((s) => s.role === "manager" && s.status === "active") ||
    staffList[0];

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
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        expiringCount={expiringCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
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
              onCreatePromotion={createPromotion}
              onChangePromotionStatus={changePromotionStatus}
            />
          )}

          {activeModule === 3 && (
            <QuanLyKho
              products={products}
              batches={batches}
              reloadBatches={reloadBatches}
              currentStaff={currentStaff}
            />
          )}

          {activeModule === 4 && (
            <QuanLyNhanVien
              staffList={staffList}
              onAddStaff={handleAddStaff}
              onUpdateShift={handleUpdateShift}
            />
          )}

          {activeModule === 5 && <QuanLyNhaCungCap products={products} />}

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
  );
}
