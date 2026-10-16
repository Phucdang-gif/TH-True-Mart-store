import { CashSessionStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryCashSessionDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CashSessionStatus)
  status?: CashSessionStatus;

  /** Chỉ quản lý được lọc theo thu ngân khác; thu ngân luôn chỉ thấy ca của mình */
  @IsOptional()
  @IsString()
  cashierId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(['openedAt', 'closedAt'])
  sortBy: 'openedAt' | 'closedAt' = 'openedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
