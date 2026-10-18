import { useState, useEffect, useCallback } from 'react';
import {
  purchaseOrderService,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
} from '../services/purchase-orders';
import type { PurchaseOrder } from '../types';

export const usePurchaseOrders = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hàm tải danh sách đơn đặt hàng
  const fetchPurchaseOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await purchaseOrderService.getAll();
      setPurchaseOrders(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách đơn đặt hàng');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Tự động gọi API khi component được render lần đầu
  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

  // Hàm thêm mới
  const addPurchaseOrder = async (data: CreatePurchaseOrderDto) => {
    try {
      setError(null);
      const created = await purchaseOrderService.create(data);
      setPurchaseOrders((prev) => [created, ...prev]);
      return true; // true = thành công (để component đóng Modal)
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo đơn đặt hàng');
      return false;
    }
  };

  // Hàm cập nhật (hủy đơn, sửa ghi chú)
  const updatePurchaseOrder = async (id: string, data: UpdatePurchaseOrderDto) => {
    try {
      setError(null);
      const updated = await purchaseOrderService.update(id, data);
      // Chỉ gộp status/notes mới, giữ nguyên tên NCC và items đã có trong state
      setPurchaseOrders((prev) =>
        prev.map((po) => (po.id === id ? { ...po, ...updated } : po)),
      );
      return true;
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật đơn đặt hàng');
      return false;
    }
  };

  // Hàm xóa
  const deletePurchaseOrder = async (id: string) => {
    try {
      setError(null);
      await purchaseOrderService.remove(id);
      setPurchaseOrders((prev) => prev.filter((po) => po.id !== id));
      return true;
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa đơn đặt hàng');
      return false;
    }
  };

  // Hàm nhận hàng & nhập kho: xong thì tải lại danh sách để cập nhật trạng thái "received"
  const receivePurchaseOrder = async (id: string, data: ReceivePurchaseOrderDto) => {
    try {
      setError(null);
      await purchaseOrderService.receive(id, data);
      await fetchPurchaseOrders();
      return true;
    } catch (err: any) {
      setError(err.message || 'Lỗi khi nhận hàng');
      return false;
    }
  };

  return {
    purchaseOrders,
    isLoading,
    error,
    fetchPurchaseOrders,
    addPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    receivePurchaseOrder,
  };
};