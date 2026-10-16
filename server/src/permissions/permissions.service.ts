import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isUniqueViolation } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { QueryPermissionDto } from './dto/query-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePermissionDto) {
    try {
      return await this.prisma.permissions.create({ data: dto });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException(`Quyền "${dto.code}" đã tồn tại`);
      throw e;
    }
  }

  /** Không phân trang: danh sách quyền ngắn, dùng để hiển thị ma trận phân quyền */
  async findAll(query: QueryPermissionDto) {
    const where: Prisma.permissionsWhereInput = {
      ...(query.module && { module: query.module }),
      ...(query.search && {
        OR: [
          { code: { contains: query.search, mode: 'insensitive' } },
          { name: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    return this.prisma.permissions.findMany({ where, orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  }

  async findOne(id: string) {
    const p = await this.prisma.permissions.findUnique({
      where: { id },
      include: { role_permissions: { include: { roles: { select: { id: true, code: true, name: true } } } } },
    });
    if (!p) throw new NotFoundException('Không tìm thấy quyền');
    const { role_permissions, ...rest } = p;
    return { ...rest, roles: role_permissions.map((rp) => rp.roles) };
  }

  async update(id: string, dto: UpdatePermissionDto) {
    if (Object.values(dto).every((v) => v === undefined)) {
      throw new BadRequestException('Không có trường nào để cập nhật');
    }
    const current = await this.prisma.permissions.findUnique({
      where: { id },
      select: { id: true, _count: { select: { role_permissions: true } } },
    });
    if (!current) throw new NotFoundException('Không tìm thấy quyền');
    // code là khóa nghiệp vụ mà code backend/frontend tham chiếu -> không đổi khi đã gán cho vai trò
    if (dto.code !== undefined && current._count.role_permissions > 0) {
      throw new BadRequestException('Quyền đã gán cho vai trò nên không thể đổi code');
    }
    try {
      return await this.prisma.permissions.update({ where: { id }, data: dto });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException(`Quyền "${dto.code}" đã tồn tại`);
      throw e;
    }
  }

  async remove(id: string) {
    const p = await this.prisma.permissions.findUnique({
      where: { id },
      select: { id: true, code: true, _count: { select: { role_permissions: true } } },
    });
    if (!p) throw new NotFoundException('Không tìm thấy quyền');
    if (p._count.role_permissions > 0) {
      throw new BadRequestException(
        `Quyền ${p.code} đang được gán cho ${p._count.role_permissions} vai trò, hãy gỡ khỏi các vai trò trước`,
      );
    }
    await this.prisma.permissions.delete({ where: { id } });
    return { id, code: p.code, deleted: true };
  }
}
