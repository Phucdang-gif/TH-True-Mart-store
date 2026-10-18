import { IsString, IsNotEmpty, IsNumber, IsEnum, NotEquals, ValidateIf } from 'class-validator';
import { StockMovementType } from '@prisma/client';

export class CreateStockMovementDto {
  @IsString()
  @IsNotEmpty({ message: 'ID Lô hàng không được để trống' })
  batchId: string;

  // Chỉ cho phép nhập tay loại 'export' (xuất hủy) hoặc 'adjust' (điều chỉnh)
  @IsEnum(['export', 'adjust'], { message: 'Loại biến động chỉ được là export hoặc adjust' })
  @IsNotEmpty()
  type: StockMovementType;

  @IsNumber()
  @NotEquals(0, { message: 'Số lượng biến động không được bằng 0' })
  quantity: number;

  @IsString()
  @IsNotEmpty({ message: 'Bắt buộc phải nhập lý do khi xuất hủy hoặc điều chỉnh' })
  reason: string;
}