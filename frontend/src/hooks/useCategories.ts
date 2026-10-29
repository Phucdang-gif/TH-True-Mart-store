import { useState, useEffect, useCallback } from 'react';
import { categoriesApi, CategoryItem } from '../services/categories';

export function useCategories() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setError(null);
      const data = await categoriesApi.list();
      setCategories(data);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh mục sản phẩm');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = async (data: { code: string; name: string; description?: string }) => {
    const created = await categoriesApi.create(data);
    setCategories((prev) => [created, ...prev]);
    return created;
  };

  const updateCategory = async (id: string, data: Partial<CategoryItem>) => {
    const updated = await categoriesApi.update(id, data);
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  };

  const deleteCategory = async (id: string) => {
    await categoriesApi.delete(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  return {
    categories,
    isLoading,
    error,
    reloadCategories: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
