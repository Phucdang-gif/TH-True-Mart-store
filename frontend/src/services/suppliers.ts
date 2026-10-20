// Import đúng tên hàm fetchApi theo dạng ngoặc nhọn (named import)
import { fetchApi } from '../lib/api';
import type{ Supplier, SupplierStatus } from '../types'

export type CreateSupplierDto = Omit<Supplier, 'id' | 'status'> & {
  status?: SupplierStatus;
};

export const supplierService = {
  // Lấy danh sách nhà cung cấp (ĐẢM BẢO CÓ /api Ở ĐÂY)
  getAll: async () => {
    return await fetchApi<Supplier[]>('/api/suppliers'); 
  },

  // Thêm mới
  create: async (data: CreateSupplierDto) => {
    return await fetchApi<Supplier>('/api/suppliers', { 
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Cập nhật
  update: async (id: string, data: Partial<CreateSupplierDto>) => {
    return await fetchApi<Supplier>(`/api/suppliers/${id}`, { 
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Xóa
  remove: async (id: string) => {
    return await fetchApi<void>(`/api/suppliers/${id}`, { 
      method: 'DELETE',
    });
  }
};