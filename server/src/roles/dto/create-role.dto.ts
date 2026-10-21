import { IsArray, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]*$/)
  @MaxLength(50)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @IsString({ each: true })
  permissionIds: string[];
}
