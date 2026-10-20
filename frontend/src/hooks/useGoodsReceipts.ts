import { goodsReceiptService, CreateGoodsReceiptInput } from '../services/goods-receipts';

export function useGoodsReceipts() {
  // Ném lỗi (throw) để giao diện hiển thị thông báo từ server
  const createReceipt = async (input: CreateGoodsReceiptInput) => {
    await goodsReceiptService.create(input);
  };

  return { createReceipt };
}