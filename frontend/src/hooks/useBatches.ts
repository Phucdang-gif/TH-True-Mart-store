import { useState, useEffect } from "react";
import { Batch } from "../types";
import { batchesApi } from "../services/batches"; 

export function useBatches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    batchesApi
      .getAll()
      .then(setBatches)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Tải lại tồn kho từ server (sau khi bán hàng / đổi trả làm thay đổi số lượng lô)
  const refresh = async () => {
    setBatches(await batchesApi.getAll());
  };

  const addBatch = async (data: Omit<Batch, "id">) => {
    const created = await batchesApi.create(data);
    setBatches((prev) => [created, ...prev]); 
  };

  const adjustStock = async (id: string, quantity: number, reason?: string) => {
    const updated = await batchesApi.adjustStock(id, quantity, reason);
    setBatches((prev) => prev.map((b) => (b.id === id ? updated : b)));
  };

  return { 
    batches, 
    setBatches, // Vẫn phải export setBatches để App.tsx xử lý logic trừ kho FIFO khi POS bán hàng
    loading, 
    error, 
    addBatch, 
    adjustStock,
    refresh,
  };
}