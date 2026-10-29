import { fetchApi } from '../lib/api';

export interface CategoryItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export const categoriesApi = {
  list: async (): Promise<CategoryItem[]> => {
    const data = await fetchApi<CategoryItem[]>('/api/categories');
    return Array.isArray(data) ? data : [];
  },

  getOne: async (id: string): Promise<CategoryItem> => {
    return fetchApi<CategoryItem>(`/api/categories/${id}`);
  },

  create: async (data: { code: string; name: string; description?: string }): Promise<CategoryItem> => {
    return fetchApi<CategoryItem>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: Partial<CategoryItem>): Promise<CategoryItem> => {
    return fetchApi<CategoryItem>(`/api/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    return fetchApi<void>(`/api/categories/${id}`, {
      method: 'DELETE',
    });
  },
};
