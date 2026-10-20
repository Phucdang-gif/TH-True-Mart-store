import { fetchApi } from '../lib/api';
import { Batch } from '../types'; // Import interface chuẩn từ thư mục types

export const batchService = {
  // Lấy danh sách tất cả các lô hàng
  async getAll(): Promise<Batch[]> {
    const res = await fetchApi<any>('/api/batches');
    return Array.isArray(res) ? res : res?.data || [];
  },

  // Thêm lô hàng mới (hoặc thông qua goods-receipts)
  async create(data: Omit<Batch, 'id' | 'createdAt'>): Promise<Batch> {
    return await fetchApi<Batch>('/api/batches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Cập nhật số lượng / thông tin lô hàng
  async update(id: string, data: Partial<Batch>): Promise<Batch> {
    return await fetchApi<Batch>(`/api/batches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};