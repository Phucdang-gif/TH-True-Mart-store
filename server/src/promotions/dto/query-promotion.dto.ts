import { DiscountType, PromotionScope, PromotionStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const toBool = ({ value }: { value: unknown }) => value === true || value === 'true';

export class QueryPromotionDto extends PaginationQueryDto {
  /** Tìm theo mã hoặc tên */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;

  @IsOptional()
  @IsEnum(PromotionScope)
  scope?: PromotionScope;

  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  requiresCode?: boolean;

  /** Chỉ lấy chương trình đang chạy: status = active và trong khoảng ngày hiệu lực */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  activeNow?: boolean;

  @IsOptional()
  @IsIn(['createdAt', 'startDate', 'endDate', 'name', 'usedCount'])
  sortBy: 'createdAt' | 'startDate' | 'endDate' | 'name' | 'usedCount' = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
