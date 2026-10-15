// dto/adjust-batch.dto.ts
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AdjustBatchDto {
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}