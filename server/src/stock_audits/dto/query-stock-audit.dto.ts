import { StockAuditStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryStockAuditDto extends PaginationQueryDto {
  /** Tìm theo mã phiếu */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(StockAuditStatus)
  status?: StockAuditStatus;

  @IsOptional()
  @IsString()
  performedById?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(['auditDate', 'createdAt'])
  sortBy: 'auditDate' | 'createdAt' = 'auditDate';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
