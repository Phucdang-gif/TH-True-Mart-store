import { fetchApi } from '../lib/api';
import { Batch } from '../types';

type Paginated<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

export const batchesApi = {
  getAll: async (): Promise<Batch[]> => {
    const all: Batch[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const res = await fetchApi<Paginated<Batch>>(
        `/api/batches?page=${page}&limit=100`,
      );
      all.push(...res.data);
      totalPages = res.meta.totalPages;
      page++;
    } while (page <= totalPages);
    return all;
  },

  create: (b: Omit<Batch, 'id'>) =>
  fetchApi<Batch>('/api/batches', {
    method: 'POST',
    body: JSON.stringify({
      productId: b.productId,
      batchCode: b.batchCode,
      manufacturingDate: b.manufacturingDate,
      expiryDate: b.expiryDate,
      quantity: b.quantity,
      importPrice: b.importPrice,
      receivedById: b.receivedById,
    }),
  }),

  adjustStock: (id: string, quantity: number, reason?: string) =>
    fetchApi<Batch>(`/api/batches/${id}/adjust`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity, reason }),
    }),
};