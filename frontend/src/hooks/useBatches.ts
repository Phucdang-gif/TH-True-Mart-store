import { useState, useEffect, useCallback } from 'react';
import { Batch } from '../types';
import { batchService } from '../services/batches';

// Nguồn dữ liệu lô hàng DUY NHẤT cho toàn app (Navbar, Kho, POS, Báo cáo)
export function useBatches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setBatches(await batchService.getAll());
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

  // setBatches được trả ra để POS (đang dùng dữ liệu giả) còn trừ kho tạm trên giao diện
  // cho tới khi nối API bán hàng. Gọi reload() sẽ đồng bộ lại với DB.
  return { batches, setBatches, loading, error, reload };
}