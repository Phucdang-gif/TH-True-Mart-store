import { fetchApi } from "../lib/api";
import { PurchaseOrder } from "../types";

// ===== Kiểu dữ liệu gửi lên backend =====
export interface PurchaseOrderItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface PurchaseOrderInput {
  supplierId: string;
  expectedDate: string; // ISO đầy đủ cho @IsDateString
  notes?: string;
  items: PurchaseOrderItemInput[];
}

// ===== Query cho list =====
export interface PurchaseOrderQuery {
  page?: number;
  limit?: number;
  status?: "pending" | "received" | "cancelled";
  supplierId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedPurchaseOrders {
  data: PurchaseOrder[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

function toQueryString(q: PurchaseOrderQuery): string {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : "";
}

export const purchaseOrdersApi = {
  // ───────── Purchase Orders ─────────
  list: (query: PurchaseOrderQuery = {}) =>
    fetchApi<PaginatedPurchaseOrders>(
      `/api/purchase-orders${toQueryString(query)}`,
    ),

  findOne: (id: string) =>
    fetchApi<PurchaseOrder>(`/api/purchase-orders/${id}`),

  create: (data: PurchaseOrderInput) =>
    fetchApi<PurchaseOrder>("/api/purchase-orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<PurchaseOrderInput>) =>
    fetchApi<PurchaseOrder>(`/api/purchase-orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateStatus: (id: string, status: "received" | "cancelled") =>
    fetchApi<PurchaseOrder>(`/api/purchase-orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  remove: (id: string) =>
    fetchApi<{ id: string; orderCode: string; deleted: boolean }>(
      `/api/purchase-orders/${id}`,
      { method: "DELETE" },
    ),

  // ───────── Purchase Order Items ─────────
  listItems: (orderId: string) =>
    fetchApi<NonNullable<PurchaseOrder["purchase_order_items"]>>(
      `/api/purchase-orders/${orderId}/items`,
    ),

  addItem: (orderId: string, item: PurchaseOrderItemInput) =>
    fetchApi<NonNullable<PurchaseOrder["purchase_order_items"]>[number]>(
      `/api/purchase-orders/${orderId}/items`,
      { method: "POST", body: JSON.stringify(item) },
    ),

  updateItem: (
    orderId: string,
    itemId: string,
    data: Partial<Omit<PurchaseOrderItemInput, "productId">>,
  ) =>
    fetchApi<NonNullable<PurchaseOrder["purchase_order_items"]>[number]>(
      `/api/purchase-orders/${orderId}/items/${itemId}`,
      { method: "PATCH", body: JSON.stringify(data) },
    ),

  removeItem: (orderId: string, itemId: string) =>
    fetchApi<void>(`/api/purchase-orders/${orderId}/items/${itemId}`, {
      method: "DELETE",
    }),
};