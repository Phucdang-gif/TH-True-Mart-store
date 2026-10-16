import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class StockAuditItemInputDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  /** Số lượng đếm thực tế. Tồn hệ thống và chênh lệch do server tính. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  actualQuantity: number;

  /** Bắt buộc khi có chênh lệch */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateStockAuditDto {
  @IsOptional()
  @IsDateString()
  auditDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockAuditItemInputDto)
  items: StockAuditItemInputDto[];
}
