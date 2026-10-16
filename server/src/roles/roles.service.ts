import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isUniqueViolation } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const ROLE_INCLUDE = {
  role_permissions: {
    include: { permissions: { select: { id: true, code: true, module: true, name: true } } },
  },
  _count: { select: { staff: true } },
} satisfies Prisma.rolesInclude;

type RoleWithRelations = Prisma.rolesGetPayload<{ include: typeof ROLE_INCLUDE }>;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(r: RoleWithRelations) {
    const { role_permissions, _count, ...rest } = r;
    return {
      ...rest,
      staffCount: _count.staff,
      permissions: role_permissions
        .map((rp) => rp.permissions)
        .sort((a, b) => a.module.localeCompare(b.module) || a.code.localeCompare(b.code)),
    };
  }

  private async assertPermissionsExist(ids: string[]) {
    if (ids.length === 0) return;
    const count = await this.prisma.permissions.count({ where: { id: { in: ids } } });
    if (count !== ids.length) throw new NotFoundException('Có quyền trong permissionIds không tồn tại');
  }

  async create(dto: CreateRoleDto) {
    const permissionIds = dto.permissionIds ?? [];
    await this.assertPermissionsExist(permissionIds);
    try {
      const created = await this.prisma.roles.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          isSystem: false, // vai trò hệ thống chỉ do seed tạo
          ...(permissionIds.length > 0 && {
            role_permissions: {
              createMany: { data: permissionIds.map((permissionId) => ({ permissionId })) },
            },
          }),
        },
        include: ROLE_INCLUDE,
      });
      return this.toResponse(created);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException(`Vai trò "${dto.code}" đã tồn tại`);
      throw e;
    }
  }

  async findAll() {
    const rows = await this.prisma.roles.findMany({ include: ROLE_INCLUDE, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.toResponse(r));
  }

  async findOne(id: string) {
    const role = await this.prisma.roles.findUnique({ where: { id }, include: ROLE_INCLUDE });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    return this.toResponse(role);
  }

  async update(id: string, dto: UpdateRoleDto) {
    if (Object.values(dto).every((v) => v === undefined)) {
      throw new BadRequestException('Không có trường nào để cập nhật');
    }
    const exists = await this.prisma.roles.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Không tìm thấy vai trò');
    await this.prisma.roles.update({ where: { id }, data: dto });
    return this.findOne(id);
  }

  /** Thay thế toàn bộ quyền của vai trò */
  async setPermissions(id: string, dto: SetRolePermissionsDto) {
    const role = await this.prisma.roles.findUnique({ where: { id }, select: { id: true } });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    await this.assertPermissionsExist(dto.permissionIds);

    await this.prisma.$transaction([
      this.prisma.role_permissions.deleteMany({ where: { roleId: id } }),
      ...(dto.permissionIds.length > 0
        ? [
            this.prisma.role_permissions.createMany({
              data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
            }),
          ]
        : []),
    ]);
    return this.findOne(id);
  }

  async remove(id: string) {
    const role = await this.prisma.roles.findUnique({
      where: { id },
      select: { id: true, code: true, isSystem: true, _count: { select: { staff: true } } },
    });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    if (role.isSystem) throw new BadRequestException('Vai trò hệ thống không được xoá');
    if (role._count.staff > 0) {
      throw new BadRequestException(`Vai trò đang được gán cho ${role._count.staff} nhân viên`);
    }
    await this.prisma.roles.delete({ where: { id } }); // role_permissions tự xoá theo (ON DELETE CASCADE)
    return { id, code: role.code, deleted: true };
  }
}
