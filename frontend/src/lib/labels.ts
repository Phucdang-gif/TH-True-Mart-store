// Ánh xạ giá trị ENUM của database (init.sql) <-> nhãn tiếng Việt hiển thị trên giao diện.
// Database luôn lưu/nhận MÃ ENUM; giao diện chỉ dùng nhãn khi hiển thị.
import type {
  Category, Shift, StaffRole, PaymentMethod, InvoiceStatus,
  PromotionStatus, PromotionScope, PurchaseOrderStatus,
} from '../types';

export const CATEGORY_LABELS: Record<Category, string> = {
  SUA_TUOI_TIET_TRUNG: 'Sữa tươi tiệt trùng',
  SUA_TUOI_THANH_TRUNG: 'Sữa tươi thanh trùng',
  SUA_CHUA: 'Sữa chua ăn & uống',
  BO_PHOMAI: 'Bơ & Phô mai tự nhiên',
  KEM: 'Kem TH true ICE CREAM',
  NUOC: 'Nước tinh khiết & Nước trái cây',
  TRA: 'Trà tự nhiên TH true TEA',
};
export const CATEGORY_LIST = Object.keys(CATEGORY_LABELS) as Category[];

export const SHIFT_LABELS: Record<Shift, string> = {
  SANG: 'Sáng (06:00 - 14:00)',
  CHIEU: 'Chiều (14:00 - 22:00)',
  HANH_CHINH: 'Hành chính',
};
export const SHIFT_LIST = Object.keys(SHIFT_LABELS) as Shift[];

export const ROLE_LABELS: Record<StaffRole, string> = {
  manager: 'Quản lý',
  cashier: 'Thu ngân',
  warehouse: 'Thủ kho',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
  card: 'Thẻ',
  mixed: 'Nhiều hình thức',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  completed: 'Đã hoàn tất',
  pending_payment: 'Chờ thanh toán',
  pending_approval: 'Chờ quản lý duyệt',
  returned: 'Đã đổi trả',
  cancelled: 'Đã hủy',
};

export const PROMOTION_STATUS_LABELS: Record<PromotionStatus, string> = {
  draft: 'Nháp',
  scheduled: 'Chờ áp dụng',
  active: 'Đang chạy',
  paused: 'Tạm dừng',
  expired: 'Hết hạn',
};

export const PROMOTION_SCOPE_LABELS: Record<PromotionScope, string> = {
  order: 'Cả hóa đơn',
  category: 'Theo nhóm hàng',
  product: 'Sản phẩm chỉ định',
  near_expiry: 'Lô sắp hết hạn (xả hàng)',
};

export const PURCHASE_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  pending: 'Chờ nhận hàng',
  received: 'Đã nhận',
  cancelled: 'Đã hủy',
};

// Prisma trả DECIMAL dưới dạng chuỗi ("25000.00") -> ép về số trước khi tính toán
export const toNum = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
