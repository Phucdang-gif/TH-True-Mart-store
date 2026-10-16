import { IsOptional, IsString } from 'class-validator';

export class QueryPermissionDto {
  @IsOptional()
  @IsString()
  module?: string;

  /** Tìm theo code hoặc tên */
  @IsOptional()
  @IsString()
  search?: string;
}
