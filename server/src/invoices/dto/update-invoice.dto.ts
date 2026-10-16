import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Hóa đơn là chứng từ tài chính nên chỉ cho sửa ghi chú. Muốn thay đổi khác: đổi trả / hủy. */
export class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
