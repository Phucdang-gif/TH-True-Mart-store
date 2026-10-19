import { fetchApi } from '../lib/api';
import type { StockAudit, StockAuditItem, StockAuditStatus } from '../types';

// Body POST /api/stock-audits (khớp CreateStockAuditDto ở backend)
export interface CreateStockAuditDto {
  auditCode: string;
  items: { batchId: string; actualQuantity: number; reason?: string }[];
}

// JSON thô backend trả về (Prisma)
interface StockAuditApi {
  id: string;
  auditCode: string;
  auditDate: string;
  performedById: string;
  approvedById: string | null;
  status: StockAuditStatus;
  stock_audit_items?: {
    batchId: string;
    systemQuantity: number;
    actualQuantity: number;
    difference: number | null;
    reason: string | null;
    batches?: {
      productId: string;
      batchCode: string;
      products?: { name: string; unit?: string } | null;
    } | null;
  }[];
  staff_stock_audits_performedByIdTostaff?: { name: string } | null;
  staff_stock_audits_approvedByIdTostaff?: { name: string } | null;
}

function toStockAudit(raw: StockAuditApi): StockAudit {
  const items: StockAuditItem[] = (raw.stock_audit_items ?? []).map((i) => ({
    batchId: i.batchId,
    productId: i.batches?.productId ?? '',
    productName: i.batches?.products?.name ?? '',
    batchCode: i.batches?.batchCode,
    unit: i.batches?.products?.unit,
    systemQuantity: i.systemQuantity,
    actualQuantity: i.actualQuantity,
    difference: i.difference ?? i.actualQuantity - i.systemQuantity,
    reason: i.reason ?? '',
  }));
  return {
    id: raw.id,
    auditCode: raw.auditCode,
    auditDate: new Date(raw.auditDate).toLocaleString('vi-VN'),
    performedById: raw.performedById,
    performedByName: raw.staff_stock_audits_performedByIdTostaff?.name,
    approvedById: raw.approvedById ?? undefined,
    approvedByName: raw.staff_stock_audits_approvedByIdTostaff?.name,
    status: raw.status,
    items,
  };
}

export const stockAuditService = {
  // Lịch sử phiếu kiểm kê (lấy từ DB nên không mất khi tải lại trang)
  getAll: async (): Promise<StockAudit[]> => {
    const data = await fetchApi<StockAuditApi[]>('/api/stock-audits');
    return (Array.isArray(data) ? data : []).map(toStockAudit);
  },

  // Thủ kho gửi phiếu (trạng thái pending_approval)
  create: async (data: CreateStockAuditDto): Promise<void> => {
    await fetchApi<unknown>('/api/stock-audits', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Quản lý duyệt / từ chối. Khi duyệt, backend ghi sổ kho và trigger DB cập nhật tồn lô.
  review: async (id: string, approved: boolean): Promise<void> => {
    await fetchApi<unknown>(`/api/stock-audits/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: approved ? 'approved' : 'rejected' }),
    });
  },
};
