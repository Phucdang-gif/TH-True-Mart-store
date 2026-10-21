import { useState, useEffect, useCallback } from 'react';
import { Invoice } from '../types';
import { invoiceService } from '../services/invoices';
import type { PreviewInvoiceInput, CreateInvoiceInput } from '../types/api';

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setInvoices(await invoiceService.getAll());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Ném lỗi (throw) để giao diện hiển thị thông báo từ server (hết hàng, mã sai, thiếu tiền...)
  const previewInvoice = (input: PreviewInvoiceInput) => invoiceService.preview(input);

  const createInvoice = async (input: CreateInvoiceInput): Promise<Invoice> => {
    const invoice = await invoiceService.create(input);
    await reload();
    return invoice;
  };

  return { invoices, loading, error, reload, previewInvoice, createInvoice };
}
