import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ValidateCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  /** Giá trị đơn hiện tại (để kiểm tra minOrderValue và ước tính giảm) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  orderValue?: number;
}
