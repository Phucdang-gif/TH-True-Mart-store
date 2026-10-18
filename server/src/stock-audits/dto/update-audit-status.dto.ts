import { IsEnum, IsNotEmpty } from 'class-validator';
import { StockAuditStatus } from '@prisma/client';

export class UpdateAuditStatusDto {
  // Chỉ cho phép cập nhật sang trạng thái duyệt hoặc từ chối
  @IsEnum(['approved', 'rejected'], { message: 'Trạng thái chỉ được là approved hoặc rejected' })
  @IsNotEmpty()
  status: StockAuditStatus;
}