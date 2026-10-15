import { fetchApi } from "../lib/api";
import { toNum } from "../lib/labels";
import { Invoice, InvoiceApproval, InvoiceItem, InvoicePayment, PaymentMethod } from "../types";

// ===== Dữ liệu gửi lên server =====
export interface CartLinePayload {
  productId: string;
  quantity: number;
}

export interface PaymentPayload {
  method: Exclude<PaymentMethod, "mixed">;
  amount: number;
  reference?: string;
}

export interface CreateInvoicePayload {
  items: CartLinePayload[];
  voucherCode?: string;
  payments: PaymentPayload[];
  notes?: string;
}

export interface ApprovalPayload {
  reason: string;
  refundMethod: Exclude<PaymentMethod, "mixed">;
  refundRef?: string;
}

// ===== Kết quả tính thử (POST /invoices/preview) =====
export interface AppliedPromotion {
  promotionId: string;
  code: string;
  name: string;
  discountAmount: number;
}

export interface InvoicePreview {
  subtotal: number;
  productDiscount: number;
  promotionDiscount: number;
  discountAmount: number;
  finalTotal: number;
  appliedPromotions: AppliedPromotion[];
  voucherCode?: string;
}

// Prisma trả DECIMAL dạng chuỗi và ngày dạng ISO -> chuẩn hóa về kiểu Invoice của frontend
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleString("vi-VN") : undefined);

const normalizeInvoice = (r: any): Invoice => ({
  id: r.id,
  code: r.code,
  createdAt: fmtDate(r.createdAt)!,
  cashierId: r.cashierId,
  cashierName: r.staff?.name ?? "",
  cashSessionId: r.cashSessionId ?? undefined,
  items: (r.invoice_items ?? []).map(
    (i: any): InvoiceItem => ({
      productId: i.productId,
      productCode: i.products?.code ?? "",
      productName: i.products?.name ?? "",
      batchId: i.batchId ?? undefined,
      batchCode: i.batches?.batchCode ?? "",
      unit: i.products?.unit ?? "",
      quantity: i.quantity,
      unitPrice: toNum(i.unitPrice),
      discount: toNum(i.discount), // tổng giảm của dòng (gồm giảm riêng + khuyến mãi)
      subtotal: toNum(i.subtotal),
    }),
  ),
  subtotal: toNum(r.subtotal),
  discountAmount: toNum(r.discountAmount),
  voucherCode: r.voucherCode ?? undefined,
  finalTotal: toNum(r.finalTotal),
  paymentMethod: r.paymentMethod,
  payments: (r.invoice_payments ?? []).map(
    (p: any): InvoicePayment => ({
      id: p.id,
      method: p.method,
      amount: toNum(p.amount),
      status: p.status,
      reference: p.reference ?? undefined,
      confirmedById: p.confirmedById ?? undefined,
      confirmedAt: fmtDate(p.confirmedAt),
    }),
  ),
  receivedAmount: toNum(r.receivedAmount),
  changeAmount: toNum(r.changeAmount),
  paidAt: fmtDate(r.paidAt),
  status: r.status,
  notes: r.notes ?? undefined,
  approvals: (r.invoice_approvals ?? []).map(
    (a: any): InvoiceApproval => ({
      id: a.id,
      action: a.action,
      reason: a.reason,
      refundAmount: toNum(a.refundAmount),
      refundMethod: a.refundMethod ?? undefined,
      refundRef: a.refundRef ?? undefined,
      approvedById: a.approvedById,
      createdAt: fmtDate(a.createdAt)!,
    }),
  ),
});

export const invoicesApi = {
  list: async () =>
    (await fetchApi<any[]>("/api/invoices")).map(normalizeInvoice),

  // Tính thử giỏ hàng + khuyến mãi (không ghi DB)
  preview: (items: CartLinePayload[], voucherCode?: string) =>
    fetchApi<InvoicePreview>("/api/invoices/preview", {
      method: "POST",
      body: JSON.stringify({ items, voucherCode: voucherCode || undefined }),
    }),

  // Lập hóa đơn + thanh toán + trừ kho
  create: async (data: CreateInvoicePayload) =>
    normalizeInvoice(
      await fetchApi<any>("/api/invoices", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ),

  returnInvoice: async (id: string, data: ApprovalPayload) =>
    normalizeInvoice(
      await fetchApi<any>(`/api/invoices/${id}/return`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ),

  cancelInvoice: async (id: string, data: ApprovalPayload) =>
    normalizeInvoice(
      await fetchApi<any>(`/api/invoices/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ),
};
