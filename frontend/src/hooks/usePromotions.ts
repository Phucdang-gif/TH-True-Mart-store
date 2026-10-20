import { useState, useEffect, useCallback } from 'react';
import { Promotion } from '../types';
import { promotionService, CreatePromotionInput, PromotionAction } from '../services/promotions';

export function usePromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setPromotions(await promotionService.getAll());
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

  // Ném lỗi (throw) để giao diện hiển thị thông báo từ server
  const createPromotion = async (input: CreatePromotionInput) => {
    await promotionService.create(input);
    await reload();
  };

  const changePromotionStatus = async (id: string, action: PromotionAction) => {
    await promotionService.changeStatus(id, action);
    await reload();
  };

  return { promotions, loading, error, reload, createPromotion, changePromotionStatus };
}