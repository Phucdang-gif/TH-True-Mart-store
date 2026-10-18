import { fetchApi } from '../lib/api';
import type { PurchaseOrder, PurchaseOrderStatus } from '../types';

// Body POST /api/purchase-orders (khớp CreatePurchaseOrderDto ở backend).
// KHÔNG gửi supplierName, totalAmount, status, productName, subtotal: backend tự xử lý.
export interface CreatePurchaseOrderDto {
  supplierId: string;
  expectedDate: string; // "YYYY-MM-DD"
  notes?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
}

// Body PATCH /api/purchase-orders/:id (thường dùng để hủy đơn)
export interface UpdatePurchaseOrderDto {
  notes?: string;
  status?: PurchaseOrderStatus;
}

// Body POST /api/purchase-orders/:id/receive (nhập kho)
export interface ReceivePurchaseOrderDto {
  items: {
    productId: string;
    batchCode: string;
    manufacturingDate: string; // "YYYY-MM-DD"
    expiryDate: string; // "YYYY-MM-DD"
    quantity: number;
    importPrice: number;
  }[];
}

// JSON thô backend trả về (Prisma): Decimal -> chuỗi, DateTime -> ISO, relation lồng bên trong
interface PurchaseOrderApi {
  id: string;
  orderCode: string;
  supplierId: string;
  createdAt: string;
  expectedDate: string;
  totalAmount: string | number;
  status: PurchaseOrderStatus;
  notes: string | null;
  suppliers?: { name: string } | null;
  purchase_order_items?: {
    productId: string;
    quantity: number;
    unitPrice: string | number;
    products?: { name: string } | null;
  }[];
}

const toNum = (v: string | number | null | undefined): number => Number(v ?? 0);

// Chuyển record thô của backend sang interface PurchaseOrder mà giao diện đang dùng
function toPurchaseOrder(raw: PurchaseOrderApi): PurchaseOrder {
  return {
    id: raw.id,
    orderCode: raw.orderCode,
    supplierId: raw.supplierId,
    supplierName: raw.suppliers?.name ?? '(Nhà cung cấp đã xóa)',
    createdAt: String(raw.createdAt).slice(0, 10),
    expectedDate: String(raw.expectedDate).slice(0, 10),
    items: (raw.purchase_order_items ?? []).map((item) => {
      const unitPrice = toNum(item.unitPrice);
      return {
        productId: item.productId,
        productName: item.products?.name ?? 'Sản phẩm',
        quantity: item.quantity,
        unitPrice,
        subtotal: unitPrice * item.quantity,
      };
    }),
    totalAmount: toNum(raw.totalAmount),
    status: raw.status,
    notes: raw.notes ?? undefined,
  };
}

export const purchaseOrderService = {
  // Lấy danh sách đơn đặt hàng
  getAll: async (): Promise<PurchaseOrder[]> => {
    const data = await fetchApi<PurchaseOrderApi[]>('/api/purchase-orders');
    return data.map(toPurchaseOrder);
  },

  // Lập đơn mới
  create: async (data: CreatePurchaseOrderDto): Promise<PurchaseOrder> => {
    const res = await fetchApi<PurchaseOrderApi>('/api/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return toPurchaseOrder(res);
  },

  // Cập nhật (hủy đơn / sửa ghi chú). Backend không trả kèm relation nên chỉ lấy status + notes.
  update: async (
    id: string,
    data: UpdatePurchaseOrderDto,
  ): Promise<Pick<PurchaseOrder, 'status' | 'notes'>> => {
    const res = await fetchApi<PurchaseOrderApi>(`/api/purchase-orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return { status: res.status, notes: res.notes ?? undefined };
  },

  // Xóa
  remove: async (id: string) => {
    return await fetchApi<void>(`/api/purchase-orders/${id}`, {
      method: 'DELETE',
    });
  },

  // Nhận hàng & nhập kho
  receive: async (id: string, data: ReceivePurchaseOrderDto) => {
    return await fetchApi<unknown>(`/api/purchase-orders/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};