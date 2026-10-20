import { fetchApi } from '../lib/api';

// Body POST /api/goods-receipts (khớp CreateGoodsReceiptDto)
export interface CreateGoodsReceiptInput {
  supplierId: string;
  purchaseOrderId?: string;
  notes?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    batchCode: string;
    manufacturingDate?: string; // ISO
    expiryDate: string; // ISO
  }[];
}

export const goodsReceiptService = {
  create: async (data: CreateGoodsReceiptInput): Promise<void> => {
    await fetchApi<unknown>('/api/goods-receipts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};