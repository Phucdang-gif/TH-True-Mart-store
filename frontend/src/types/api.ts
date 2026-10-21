// Kiểu dữ liệu GIAO TIẾP với backend (không phải kiểu hiển thị):
//  - XxxApi          : JSON thô backend trả về (Prisma): DECIMAL là chuỗi, DateTime là ISO, relation lồng bên trong
//  - ...Input        : body gửi lên, khớp DTO ở server/src/*/dto
// Kiểu dùng cho giao diện (đã gộp, đã ép số) nằm ở types/index.ts; services/ chuyển từ XxxApi sang kiểu đó.

import type { InvoiceStatus, PaymentStatus } from './index';

// ---------- Invoices ----------
export interface InvoiceLineInput {
  productId: string;
  quantity: number;
}

// Body POST /api/invoices/preview
export interface PreviewInvoiceInput {
  items: InvoiceLineInput[];
  voucherCode?: string;
}

// amount (đồng): với 'cash' là SỐ TIỀN KHÁCH ĐƯA (server tự tính tiền thừa)
export interface InvoicePaymentInput {
  method: 'cash' | 'transfer' | 'card';
  amount: number;
  reference?: string; // bắt buộc với transfer (mã giao dịch) và card (mã chuẩn chi)
}

// Body POST /api/invoices
export interface CreateInvoiceInput extends PreviewInvoiceInput {
  payments: InvoicePaymentInput[];
  notes?: string;
}

export interface InvoiceApi {
  id: string;
  code: string;
  cashierId: string;
  subtotal: string | number;
  discountAmount: string | number;
  finalTotal: string | number;
  status: InvoiceStatus | 'draft';
  notes: string | null;
  createdAt: string;
  paidAt: string | null;
  staff?: { name: string; code: string } | null;
  invoice_items?: {
    id: string;
    productId: string;
    batchId: string;
    quantity: number;
    unitPrice: string | number;
    discount: string | number;
    subtotal: string | number | null;
    products?: { code: string; name: string; unit: string } | null;
    batches?: { batchCode: string } | null;
  }[];
  invoice_payments?: {
    id: string;
    method: 'cash' | 'transfer' | 'card';
    amount: string | number;
    cashReceived: string | number | null;
    status: PaymentStatus;
    reference: string | null;
    confirmedById: string | null;
    confirmedAt: string | null;
  }[];
  invoice_promotions?: {
    discountAmount: string | number;
    promotions?: { code: string; name: string; requiresCode: boolean } | null;
  }[];
}
