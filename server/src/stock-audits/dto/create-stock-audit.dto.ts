import { IsString, IsNotEmpty, IsArray, ValidateNested, IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class AuditItemDto {
  @IsString()
  @IsNotEmpty()
  batchId: string;

  @IsNumber()
  @Min(0, { message: 'Số lượng thực tế không được âm' })
  actualQuantity: number;

  @IsOptional()
  @IsString()
  reason?: string; // Sẽ bắt buộc ở Service nếu đếm lệch
}

export class CreateStockAuditDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã phiếu kiểm kê không được để trống' })
  auditCode: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditItemDto)
  items: AuditItemDto[];
}