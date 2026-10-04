// Kiểu dữ liệu khớp với database (init.sql). Giá trị ENUM dùng đúng mã trong DB;
// nhãn tiếng Việt nằm ở src/lib/labels.ts.

export type Category =
  | 'SUA_TUOI_TIET_TRUNG'
  | 'SUA_TUOI_THANH_TRUNG'
  | 'SUA_CHUA'
  | 'BO_PHOMAI'
  | 'KEM'
  | 'NUOC'
  | 'TRA';

export type ProductStatus = 'active' | 'discontinued';
export type BatchStatus = 'good' | 'expiring_soon' | 'expired';
// 'mixed' chỉ dùng ở Invoice.paymentMethod; từng khoản trong InvoicePayment là cash | transfer | card
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'mixed';
export type PaymentStatus = 'pending' | 'confirmed' | 'failed';
export type InvoiceStatus = 'completed' | 'pending_payment' | 'returned' | 'cancelled' | 'pending_approval';
export type CashSessionStatus = 'open' | 'closed' | 'reviewed';
export type StaffRole = 'manager' | 'cashier' | 'warehouse';
export type StaffStatus = 'active' | 'inactive';
export type Shift = 'SANG' | 'CHIEU' | 'HANH_CHINH';
export type DiscountType = 'percentage' | 'fixed_amount';
export type PromotionStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'expired';
export type PromotionScope = 'order' | 'category' | 'product' | 'near_expiry';
export type SupplierStatus = 'active' | 'inactive';
export type PurchaseOrderStatus = 'pending' | 'received' | 'cancelled';
export type StockAuditStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';

export interface Batch {
  id: string;
  batchCode: string; // e.g. LOTH2026-09A
  productId: string;
  manufacturingDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  importPrice: number;
  status: BatchStatus; // expiring_soon <= 30 days
  receivedById?: string; // staff.id người nhập kho
}

export interface Product {
  id: string;
  code: string; // e.g. TH001
  name: string;
  category: Category;
  unit: string; // Hộp 180ml, Thùng 48 hộp, Vỉ 4 hộp, Hũ 100g, Cây kem 70g, Chai 350ml
  sellingPrice: number;
  costPrice: number;
  barcode: string;
  minStockLevel: number;
  description: string;
  imageUrl?: string;
  status: ProductStatus;
  discountPercent?: number;
}

export interface CartItem {
  product: Product;
  selectedBatch?: Batch;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface InvoiceItem {
  productId: string;
  productCode: string;
  productName: string;
  batchId?: string;
  batchCode: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

// Bảng invoice_payments: từng khoản thanh toán của hóa đơn
export interface InvoicePayment {
  id: string;
  method: Exclude<PaymentMethod, 'mixed'>;
  amount: number; // số tiền tính vào hóa đơn (đã trừ tiền thối)
  status: PaymentStatus;
  reference?: string; // mã giao dịch chuyển khoản / chuẩn chi thẻ
  confirmedById?: string;
  confirmedAt?: string;
}

// Bảng invoice_approvals: lưu vết quản lý duyệt đổi trả/hủy + hoàn tiền
export interface InvoiceApproval {
  id: string;
  action: 'return' | 'cancel';
  reason: string;
  refundAmount: number;
  refundMethod?: PaymentMethod;
  refundRef?: string;
  approvedById: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  code: string; // e.g. HD-20260921-001
  createdAt: string;
  cashierId: string;
  cashierName: string;
  cashSessionId?: string;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  voucherCode?: string;
  finalTotal: number;
  paymentMethod: PaymentMethod;
  payments: InvoicePayment[];
  receivedAmount: number; // tổng tiền khách đưa (gồm cả tiền thừa)
  changeAmount: number; // tiền thối (chỉ phát sinh với tiền mặt)
  paidAt?: string; // thời điểm thanh toán đủ; undefined = chưa xong
  status: InvoiceStatus;
  notes?: string;
  approvals?: InvoiceApproval[];
}

// Bảng cash_sessions: ca thu ngân
export interface CashSession {
  id: string;
  code: string;
  cashierId: string;
  openedAt: string;
  openingCash: number;
  closedAt?: string;
  expectedCash?: number; // openingCash + tiền mặt thu - tiền mặt hoàn
  countedCash?: number;
  difference?: number; // countedCash - expectedCash
  differenceReason?: string;
  reviewedById?: string;
  status: CashSessionStatus;
}

export interface Staff {
  id: string;
  code: string; // e.g. NV001
  name: string;
  phone: string;
  email: string;
  username: string;
  password?: string; // chỉ dùng lúc tạo mới để gửi lên API (server băm bcrypt), không lưu lại ở client
  role: StaffRole;
  status: StaffStatus;
  shift: Shift;
  mustChangePassword?: boolean;
}

export interface Promotion {
  id: string;
  code: string; // mã chương trình / mã voucher
  name: string;
  description?: string;
  scope: PromotionScope;
  discountType: DiscountType;
  value: number;
  maxDiscountAmount?: number; // trần giảm khi giảm theo %
  startDate: string;
  endDate: string;
  minOrderValue: number;
  applicableCategory?: Category; // dùng khi scope = 'category'
  nearExpiryDays?: number; // dùng khi scope = 'near_expiry'
  productIds?: string[]; // bảng promotion_products, dùng khi scope = 'product'
  requiresCode: boolean; // true: phải nhập mã; false: tự động áp dụng
  usageLimit?: number;
  usedCount: number;
  status: PromotionStatus;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  categoryProvided: string;
  status: SupplierStatus;
}

export interface PurchaseOrder {
  id: string;
  orderCode: string;
  supplierId: string;
  supplierName: string;
  createdAt: string;
  expectedDate: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  totalAmount: number;
  status: PurchaseOrderStatus;
  notes?: string;
}

export interface StockAuditItem {
  batchId?: string; // giao diện kiểm kê theo lô; server sẽ gộp theo productId khi lưu stock_audit_items
  productId: string;
  productName: string;
  systemQuantity: number;
  actualQuantity: number;
  difference: number;
  reason: string;
}

// Bảng stock_audits: phiếu kiểm kê, có bước quản lý duyệt
export interface StockAudit {
  id: string;
  auditCode: string;
  auditDate: string;
  performedById: string;
  approvedById?: string;
  status: StockAuditStatus;
  items: StockAuditItem[];
}
