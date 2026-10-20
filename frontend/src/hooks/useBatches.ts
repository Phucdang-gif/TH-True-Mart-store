import { useState, useEffect, useCallback } from "react";
import { Batch, BatchStatus } from "../types";
import { fetchApi } from "../lib/api";

// JSON thô của GET /api/batches (Prisma kèm relation products)
interface BatchApi {
  id: string;
  batchCode: string;
  productId: string;
  manufacturingDate: string;
  expiryDate: string;
  quantity: number;
  products?: { costPrice?: string | number } | null;
}

const daysLeft = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

// Bảng batches trong DB không có cột importPrice/status:
// - importPrice lấy tạm từ giá vốn của sản phẩm (dùng cho báo cáo giá trị tồn kho)
// - status tính từ hạn sử dụng
function toBatch(raw: BatchApi): Batch {
  const d = daysLeft(raw.expiryDate);
  const status: BatchStatus = d < 0 ? "expired" : d <= 30 ? "expiring_soon" : "good";
  return {
    id: raw.id,
    batchCode: raw.batchCode,
    productId: raw.productId,
    manufacturingDate: String(raw.manufacturingDate).slice(0, 10),
    expiryDate: String(raw.expiryDate).slice(0, 10),
    quantity: raw.quantity,
    importPrice: Number(raw.products?.costPrice ?? 0),
    status,
  };
}

// Nguồn dữ liệu lô hàng DUY NHẤT cho toàn app (Navbar, Kho, POS, Báo cáo)
export function useBatches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await fetchApi<BatchApi[]>("/api/batches");
      setBatches((Array.isArray(data) ? data : []).map(toBatch));
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

  // setBatches được trả ra để POS (đang dùng dữ liệu giả) còn trừ kho tạm trên giao diện
  // cho tới khi nối API bán hàng. Gọi reload() sẽ đồng bộ lại với DB.
  return { batches, setBatches, loading, error, reload };
}
