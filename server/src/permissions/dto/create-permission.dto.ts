import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  /** Dạng module:action, vd invoice:create */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+:[a-z0-9_]+$/, { message: 'code phải có dạng module:action (chữ thường), vd invoice:create' })
  code: string;

  /** sales | product | promotion | inventory | staff | supplier | report ... */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  module: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
