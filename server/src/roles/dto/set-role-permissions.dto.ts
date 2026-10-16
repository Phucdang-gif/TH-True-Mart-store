import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class SetRolePermissionsDto {
  /** Danh sách quyền MỚI của vai trò (thay thế toàn bộ). Mảng rỗng = gỡ hết quyền. */
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionIds: string[];
}
