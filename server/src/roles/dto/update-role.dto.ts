import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateRoleDto } from './create-role.dto';

/** code không đổi được (staff.role đồng bộ với roles.code qua trigger). Đổi quyền: PUT :id/permissions */
export class UpdateRoleDto extends PartialType(OmitType(CreateRoleDto, ['code', 'permissionIds'] as const)) {}
