import { fetchApi } from '../lib/api';
import type { Batch, BatchStatus } from '../types';

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

// Bảng batches không có cột importPrice/status:
// - importPrice lấy tạm từ giá vốn sản phẩm (dùng cho báo cáo giá trị tồn kho)
// - status tính từ hạn sử dụng
function toBatch(raw: BatchApi): Batch {
  const d = daysLeft(raw.expiryDate);
  const status: BatchStatus = d < 0 ? 'expired' : d <= 30 ? 'expiring_soon' : 'good';
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

export const batchService = {
  getAll: async (): Promise<Batch[]> => {
    const data = await fetchApi<BatchApi[]>('/api/batches');
    return (Array.isArray(data) ? data : []).map(toBatch);
  },
};