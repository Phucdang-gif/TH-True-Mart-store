import { BatchStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryBatchDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;

  @IsOptional()
  @IsString()
  receivedById?: string;

  /** Tìm theo mã lô hoặc tên / mã sản phẩm */
  @IsOptional()
  @IsString()
  search?: string;

  /** Chỉ lấy lô còn hàng (quantity > 0) */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  inStockOnly?: boolean;

  @IsOptional()
  @IsDateString()
  expiryFrom?: string;

  @IsOptional()
  @IsDateString()
  expiryTo?: string;

  /** Lô sắp hết hạn trong N ngày tới (chưa hết hạn). Ghi đè expiryFrom/expiryTo ở phần cận trên. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  expiringWithinDays?: number;

  @IsOptional()
  @IsIn(['expiryDate', 'createdAt', 'quantity'])
  sortBy: 'expiryDate' | 'createdAt' | 'quantity' = 'expiryDate';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';
}