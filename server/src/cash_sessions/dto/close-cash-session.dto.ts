import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CloseCashSessionDto {
  /** Số tiền mặt thu ngân đếm thực tế trong két */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  countedCash: number;

  /** Bắt buộc khi countedCash lệch so với expectedCash */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  differenceReason?: string;
}
