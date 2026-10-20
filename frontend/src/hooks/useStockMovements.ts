import { useState, useCallback } from 'react';
import {
  stockMovementService,
  CreateStockMovementDto,
  StockMovementRow,
} from '../services/stock-movements';

export function useStockMovements() {
  const [history, setHistory] = useState<StockMovementRow[]>([]);

  // Thẻ kho của 1 lô
  const loadHistory = useCallback(async (batchId: string) => {
    setHistory([]);
    try {
      setHistory(await stockMovementService.getByBatch(batchId));
    } catch (e) {
      console.error('Lỗi tải thẻ kho:', e);
    }
  }, []);

  // Ném lỗi (throw) nếu server từ chối (vd: không đủ tồn)
  const createMovement = async (input: CreateStockMovementDto) => {
    await stockMovementService.create(input);
  };

  return { history, loadHistory, createMovement };
}