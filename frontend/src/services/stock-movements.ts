import { fetchApi } from '../lib/api';

export type ManualMovementType = 'export' | 'adjust';

// Body POST /api/stock-movements (khớp CreateStockMovementDto)
// quantity: số ÂM = giảm tồn, số DƯƠNG = tăng tồn. Loại 'export' bắt buộc là số âm.
export interface CreateStockMovementDto {
  batchId: string;
  type: ManualMovementType;
  quantity: number;
  reason: string;
}

export type StockMovementKind = 'import' | 'sale' | 'export' | 'adjust' | 'audit';

export interface StockMovementRow {
  id: string;
  type: StockMovementKind;
  quantity: number;
  reason: string | null;
  createdAt: string;
  staff?: { name: string } | null;
}

export const stockMovementService = {
  create: async (data: CreateStockMovementDto): Promise<void> => {
    await fetchApi<unknown>('/api/stock-movements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Thẻ kho của 1 lô (mới nhất trước)
  getByBatch: async (batchId: string): Promise<StockMovementRow[]> => {
    const data = await fetchApi<StockMovementRow[]>(
      `/api/stock-movements?batchId=${encodeURIComponent(batchId)}`,
    );
    return Array.isArray(data) ? data : [];
  },
};
