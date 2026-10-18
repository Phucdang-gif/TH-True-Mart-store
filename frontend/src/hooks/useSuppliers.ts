import { useState, useEffect, useCallback } from 'react';
import { supplierService, Supplier, CreateSupplierDto } from '../services/suppliers';

export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hàm tải danh sách nhà cung cấp
  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await supplierService.getAll();
      setSuppliers(data);
      setError(null);
    } catch (err: any) {
      // Bắt lỗi từ fetchApi ném ra (đã được parse sẵn thành text)
      setError(err.message || 'Lỗi khi tải dữ liệu nhà cung cấp');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Tự động gọi API khi component được render lần đầu
  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // Hàm thêm mới
  const addSupplier = async (data: CreateSupplierDto) => {
    try {
      const newSupplier = await supplierService.create(data);
      // Cập nhật lại state ngay lập tức mà không cần gọi API getAll lần nữa
      setSuppliers((prev) => [newSupplier, ...prev]);
      return true; // Trả về true để component biết là thành công (để đóng Modal)
    } catch (err: any) {
      setError(err.message || 'Lỗi khi thêm nhà cung cấp');
      return false;
    }
  };

  // Hàm cập nhật
  const updateSupplier = async (id: string, data: Partial<CreateSupplierDto>) => {
    try {
      const updated = await supplierService.update(id, data);
      // Thay thế item cũ bằng item mới trong state
      setSuppliers((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return true;
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật nhà cung cấp');
      return false;
    }
  };

  // Hàm xóa
  const deleteSupplier = async (id: string) => {
    try {
      await supplierService.remove(id);
      // Lọc bỏ item đã xóa khỏi state
      setSuppliers((prev) => prev.filter((item) => item.id !== id));
      return true;
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa nhà cung cấp');
      return false;
    }
  };

  return {
    suppliers,
    isLoading,
    error,
    fetchSuppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier
  };
};