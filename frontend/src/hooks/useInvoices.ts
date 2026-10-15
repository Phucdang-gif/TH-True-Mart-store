import { useState, useEffect } from "react";
import { Invoice } from "../types";
import {
  invoicesApi,
  CreateInvoicePayload,
  ApprovalPayload,
} from "../services/invoices";

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoicesApi
      .list()
      .then(setInvoices)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Lập hóa đơn: server tính tiền, trừ kho, ghi thanh toán rồi trả hóa đơn hoàn chỉnh
  const createInvoice = async (data: CreateInvoicePayload) => {
    const created = await invoicesApi.create(data);
    setInvoices((prev) => [created, ...prev]);
    return created;
  };

  const replaceInvoice = (updated: Invoice) =>
    setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));

  const returnInvoice = async (id: string, data: ApprovalPayload) => {
    replaceInvoice(await invoicesApi.returnInvoice(id, data));
  };

  const cancelInvoice = async (id: string, data: ApprovalPayload) => {
    replaceInvoice(await invoicesApi.cancelInvoice(id, data));
  };

  return { invoices, loading, error, createInvoice, returnInvoice, cancelInvoice };
}
