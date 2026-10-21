import { fetchApi } from '../lib/api';
import { toNum } from '../lib/labels';
import type { Invoice, InvoicePayment, InvoicePreview, PaymentMethod } from '../types';
import type {
  InvoiceApi, PreviewInvoiceInput, CreateInvoiceInput,
} from '../types/api';

const fmt = (iso: string) => new Date(iso).toLocaleString('vi-VN');

// Chuyển record thô của backend sang Invoice mà giao diện đang dùng
function toInvoice(r: InvoiceApi): Invoice {
  const payments: InvoicePayment[] = (r.invoice_payments ?? []).map((p) => ({
    id: p.id,
    method: p.method,
    amount: toNum(p.amount),
    status: p.status,
    reference: p.reference ?? undefined,
    confirmedById: p.confirmedById ?? undefined,
    confirmedAt: p.confirmedAt ? fmt(p.confirmedAt) : undefined,
  }));

  const paid = payments.reduce((s, p) => s + p.amount, 0);
  // Tổng khách đưa: tiền mặt tính theo số khách đưa (gồm tiền thừa), các khoản khác theo số nhận
  const received = (r.invoice_payments ?? []).reduce(
    (s, p) => s + (p.method === 'cash' && p.cashReceived != null ? toNum(p.cashReceived) : toNum(p.amount)),
    0,
  );
  const paymentMethod: PaymentMethod = payments.length > 1 ? 'mixed' : (payments[0]?.method ?? 'cash');
  const voucher = (r.invoice_promotions ?? []).find((x) => x.promotions?.requiresCode)?.promotions?.code;

  return {
    id: r.id,
    code: r.code,
    createdAt: fmt(r.createdAt),
    cashierId: r.cashierId,
    cashierName: r.staff?.name ?? '',
    items: (r.invoice_items ?? []).map((i) => {
      const unitPrice = toNum(i.unitPrice);
      const discount = toNum(i.discount);
      return {
        productId: i.productId,
        productCode: i.products?.code ?? '',
        productName: i.products?.name ?? 'Sản phẩm',
        batchId: i.batchId,
        batchCode: i.batches?.batchCode ?? '',
        unit: i.products?.unit ?? '',
        quantity: i.quantity,
        unitPrice,
        discount,
        subtotal: i.subtotal != null ? toNum(i.subtotal) : unitPrice * i.quantity - discount,
      };
    }),
    subtotal: toNum(r.subtotal),
    discountAmount: toNum(r.discountAmount),
    voucherCode: voucher,
    finalTotal: toNum(r.finalTotal),
    paymentMethod,
    payments,
    receivedAmount: received,
    changeAmount: Math.max(0, received - paid),
    paidAt: r.paidAt ? fmt(r.paidAt) : undefined,
    // DB có thêm 'draft' (hóa đơn nháp); giao diện coi như đang chờ thanh toán
    status: r.status === 'draft' ? 'pending_payment' : r.status,
    notes: r.notes ?? undefined,
  };
}

export const invoiceService = {
  getAll: async (): Promise<Invoice[]> => {
    const data = await fetchApi<InvoiceApi[]>('/api/invoices');
    return (Array.isArray(data) ? data : []).map(toInvoice);
  },

  // Tính giá + khuyến mãi cho giỏ hàng, không ghi dữ liệu
  preview: async (input: PreviewInvoiceInput): Promise<InvoicePreview> => {
    const res = await fetchApi<InvoicePreview>('/api/invoices/preview', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return {
      ...res,
      lines: res.lines.map((l) => ({ ...l, expiryDate: String(l.expiryDate).slice(0, 10) })),
    };
  },

  // Chốt hóa đơn + thanh toán + trừ kho
  create: async (input: CreateInvoiceInput): Promise<Invoice> =>
    toInvoice(
      await fetchApi<InvoiceApi>('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    ),
};
