import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const roleInclude = {
  role_permissions: { include: { permissions: true } },
} satisfies Prisma.rolesInclude;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.roles.findMany({
      include: roleInclude,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  findPermissions() {
    return this.prisma.permissions.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateRoleDto) {
    await this.validatePermissionIds(dto.permissionIds);
    try {
      return await this.prisma.roles.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          isSystem: false,
          role_permissions: {
            create: dto.permissionIds.map((permissionId) => ({
              permissions: { connect: { id: permissionId } },
            })),
          },
        },
        include: roleInclude,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Mã nhóm quyền đã tồn tại');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateRoleDto) {
    const existing = await this.prisma.roles.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy nhóm quyền');
    if (existing.isSystem && (dto.code !== undefined || dto.name !== undefined)) {
      throw new BadRequestException('Không thể đổi mã hoặc tên của nhóm quyền hệ thống');
    }
    if (dto.permissionIds !== undefined) {
      await this.validatePermissionIds(dto.permissionIds);
      if (existing.code === 'manager') {
        const adminPermission = await this.prisma.permissions.findUnique({
          where: { code: 'staff:manage' },
          select: { id: true },
        });
        if (adminPermission && !dto.permissionIds.includes(adminPermission.id)) {
          throw new BadRequestException('Nhóm Quản lý phải giữ quyền quản lý nhóm quyền');
        }
      }
    }

    const { permissionIds, ...roleData } = dto;
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (permissionIds !== undefined) {
          await tx.role_permissions.deleteMany({ where: { roleId: id } });
          if (permissionIds.length) {
            await tx.role_permissions.createMany({
              data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
              skipDuplicates: true,
            });
          }
        }
        return tx.roles.update({
          where: { id },
          data: roleData,
          include: roleInclude,
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Mã nhóm quyền đã tồn tại');
      }
      throw error;
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.roles.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy nhóm quyền');
    if (existing.isSystem) {
      throw new BadRequestException('Không thể xóa ba nhóm quyền hệ thống');
    }
    if (await this.prisma.staff.count({ where: { roleId: id } })) {
      throw new ConflictException('Không thể xóa nhóm quyền đang được gán cho nhân viên');
    }
    await this.prisma.roles.delete({ where: { id } });
    return { success: true };
  }

  private async validatePermissionIds(permissionIds: string[]) {
    const uniqueIds = [...new Set(permissionIds)];
    if (uniqueIds.length !== permissionIds.length) {
      throw new BadRequestException('Danh sách quyền bị trùng');
    }
    const count = await this.prisma.permissions.count({ where: { id: { in: uniqueIds } } });
    if (count !== uniqueIds.length) {
      throw new BadRequestException('Có quyền không tồn tại trong hệ thống');
    }
  }
}
