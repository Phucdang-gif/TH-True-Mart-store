import type {
  StaffRole,
  PaymentMethod,
  InvoiceStatus,
  PromotionStatus,
  PromotionScope,
  PurchaseOrderStatus,
} from '../types';

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
