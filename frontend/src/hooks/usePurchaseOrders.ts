import { useCallback, useEffect, useState } from "react";
import { PurchaseOrder } from "../types";
import {
  purchaseOrdersApi,
  PurchaseOrderInput,
  PurchaseOrderQuery,
} from "../services/purchaseOrders";

export function usePurchaseOrders(initialQuery: PurchaseOrderQuery = {}) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

  const load = useCallback(async (query: PurchaseOrderQuery = initialQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await purchaseOrdersApi.list(query);
      setPurchaseOrders(res.data);
      setMeta(res.meta);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không tải được đơn nhập hàng",
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addPurchaseOrder = async (data: PurchaseOrderInput) => {
    const created = await purchaseOrdersApi.create(data);
    // Đơn mới luôn ở đầu (sortOrder mặc định desc)
    setPurchaseOrders((prev) => [created, ...prev]);
    setMeta((m) => ({ ...m, total: m.total + 1 }));
    return created;
  };

  const updatePurchaseOrder = async (
    id: string,
    data: Partial<PurchaseOrderInput>,
  ) => {
    const updated = await purchaseOrdersApi.update(id, data);
    setPurchaseOrders((prev) =>
      prev.map((p) => (p.id === id ? updated : p)),
    );
    return updated;
  };

  const updatePurchaseOrderStatus = async (
    id: string,
    status: "received" | "cancelled",
  ) => {
    const updated = await purchaseOrdersApi.updateStatus(id, status);
    setPurchaseOrders((prev) =>
      prev.map((p) => (p.id === id ? updated : p)),
    );
    return updated;
  };

  const removePurchaseOrder = async (id: string) => {
    await purchaseOrdersApi.remove(id);
    setPurchaseOrders((prev) => prev.filter((p) => p.id !== id));
    setMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) }));
  };

  return {
    purchaseOrders,
    loading,
    error,
    meta,
    reload: load,
    addPurchaseOrder,
    updatePurchaseOrder,
    updatePurchaseOrderStatus,
    removePurchaseOrder,
  };
}