import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.staff.findMany({
      include: {
        roles: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      include: {
        roles: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (!staff) throw new NotFoundException('Không tìm thấy thông tin nhân viên');
    return staff;
  }

  async create(dto: CreateStaffDto) {
    const existing = await this.prisma.staff.findFirst({
      where: {
        OR: [{ code: dto.code }, { username: dto.username }],
      },
    });

    if (existing) {
      if (existing.code === dto.code) {
        throw new BadRequestException(`Mã nhân viên "${dto.code}" đã tồn tại`);
      }
      throw new BadRequestException(`Tên đăng nhập "${dto.username}" đã tồn tại`);
    }

    const role = await this.prisma.roles.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) {
      throw new BadRequestException('Vai trò được chọn không tồn tại');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.prisma.staff.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        username: dto.username.trim().toLowerCase(),
        password: hashedPassword,
        roleId: dto.roleId,
        status: 'active',
      },
      include: {
        roles: {
          select: { id: true, code: true, name: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateStaffDto) {
    await this.findOne(id);

    return this.prisma.staff.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone?.trim(),
        roleId: dto.roleId,
        status: dto.status,
      },
      include: {
        roles: {
          select: { id: true, code: true, name: true },
        },
      },
    });
  }

  async toggleLock(id: string, lock: boolean) {
    const staff = await this.findOne(id);

    return this.prisma.staff.update({
      where: { id: staff.id },
      data: {
        status: lock ? 'inactive' : 'active',
        lockedUntil: lock ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null,
        failedLoginCount: lock ? staff.failedLoginCount : 0,
      },
      include: {
        roles: {
          select: { id: true, code: true, name: true },
        },
      },
    });
  }

  async getLoginLogs() {
    return this.prisma.login_logs.findMany({
      take: 60,
      orderBy: { createdAt: 'desc' },
      include: {
        staff: {
          select: { code: true, name: true },
        },
      },
    });
  }
}
