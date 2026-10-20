import { useState, useEffect, useCallback } from 'react';
import type { StockAudit } from '../types';
import { stockAuditService, CreateStockAuditDto } from '../services/stock-audits';

export function useStockAudits() {
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setAudits(await stockAuditService.getAll());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Ném lỗi (throw) nếu server từ chối
  const submitAudit = async (input: CreateStockAuditDto) => {
    await stockAuditService.create(input);
    await reload();
  };

  const reviewAudit = async (id: string, approved: boolean) => {
    await stockAuditService.review(id, approved);
    await reload();
  };

  return { audits, loading, error, reload, submitAudit, reviewAudit };
}