import { fetchApi } from '../lib/api';
import { toNum } from '../lib/labels';
import type {
  Promotion, PromotionScope, PromotionStatus, DiscountType, Category,
} from '../types';

export interface CreatePromotionInput {
  code: string;
  name: string;
  description?: string;
  scope: PromotionScope;
  discountType: DiscountType;
  value: number;
  maxDiscountAmount?: number;
  minOrderValue?: number;
  categoryCode?: Category;
  nearExpiryDays?: number;
  productIds?: string[];
  requiresCode?: boolean;
  usageLimit?: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  activateNow?: boolean;
}

export type PromotionAction = 'activate' | 'pause' | 'end';

interface PromotionApi {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scope: PromotionScope;
  discountType: DiscountType;
  value: string | number;
  maxDiscountAmount: string | number | null;
  minOrderValue: string | number;
  nearExpiryDays: number | null;
  requiresCode: boolean;
  usageLimit: number | null;
  usedCount: number;
  startDate: string;
  endDate: string;
  status: PromotionStatus;
  statusChangedAt: string | null;
  createdById: string;
  product_categories?: { code: string } | null;
  promotion_products?: { productId: string }[];
}

// Ngày theo giờ Việt Nam dạng YYYY-MM-DD (tránh lệch ngày do múi giờ UTC)
const vnDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

const toPromotion = (r: PromotionApi): Promotion => ({
  id: r.id,
  code: r.code,
  name: r.name,
  description: r.description ?? undefined,
  scope: r.scope,
  discountType: r.discountType,
  value: toNum(r.value),
  maxDiscountAmount: r.maxDiscountAmount == null ? undefined : toNum(r.maxDiscountAmount),
  startDate: vnDate(r.startDate),
  endDate: vnDate(r.endDate),
  minOrderValue: toNum(r.minOrderValue),
  applicableCategory: (r.product_categories?.code as Category | undefined) ?? undefined,
  nearExpiryDays: r.nearExpiryDays ?? undefined,
  productIds: (r.promotion_products ?? []).map((p) => p.productId),
  requiresCode: r.requiresCode,
  usageLimit: r.usageLimit ?? undefined,
  usedCount: r.usedCount,
  status: r.status,
  statusChangedAt: r.statusChangedAt
    ? new Date(r.statusChangedAt).toLocaleString('vi-VN')
    : undefined,
  createdById: r.createdById,
});

export const promotionService = {
  getAll: async (): Promise<Promotion[]> => {
    const data = await fetchApi<PromotionApi[]>('/api/promotions');
    return (Array.isArray(data) ? data : []).map(toPromotion);
  },

  create: async (input: CreatePromotionInput): Promise<Promotion> =>
    toPromotion(
      await fetchApi<PromotionApi>('/api/promotions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    ),

  changeStatus: async (id: string, action: PromotionAction): Promise<Promotion> =>
    toPromotion(
      await fetchApi<PromotionApi>(`/api/promotions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      }),
    ),
};