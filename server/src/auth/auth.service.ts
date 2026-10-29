import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { username: dto.username },
      include: {
        roles: {
          include: {
            role_permissions: {
              include: { permissions: true },
            },
          },
        },
      },
    });

    if (!staff) {
      await this.prisma.login_logs.create({
        data: {
          username: dto.username,
          event: 'login',
          success: false,
          reason: 'Tài khoản không tồn tại',
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    if (staff.status !== 'active') {
      await this.prisma.login_logs.create({
        data: {
          staffId: staff.id,
          username: dto.username,
          event: 'login',
          success: false,
          reason: 'Tài khoản đã bị vô hiệu hóa',
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản lý.');
    }

    if (staff.lockedUntil && staff.lockedUntil > new Date()) {
      await this.prisma.login_logs.create({
        data: {
          staffId: staff.id,
          username: dto.username,
          event: 'login',
          success: false,
          reason: 'Tài khoản đang bị tạm khóa do nhập sai nhiều lần',
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });
      throw new UnauthorizedException(
        `Tài khoản đang bị tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${staff.lockedUntil.toLocaleTimeString('vi-VN')}.`,
      );
    }

    const isMatch = await bcrypt.compare(dto.password, staff.password);
    if (!isMatch) {
      const failedCount = staff.failedLoginCount + 1;
      const isLocked = failedCount >= 5;
      await this.prisma.staff.update({
        where: { id: staff.id },
        data: {
          failedLoginCount: failedCount,
          lockedUntil: isLocked ? new Date(Date.now() + 30 * 60 * 1000) : null,
        },
      });

      await this.prisma.login_logs.create({
        data: {
          staffId: staff.id,
          username: dto.username,
          event: 'login',
          success: false,
          reason: 'Sai mật khẩu',
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });

      throw new UnauthorizedException(
        isLocked
          ? 'Tài khoản đã bị khóa tạm thời 30 phút do nhập sai quá 5 lần.'
          : 'Tên đăng nhập hoặc mật khẩu không chính xác',
      );
    }

    // Đăng nhập thành công -> Reset failedLoginCount, update lastLoginAt
    await this.prisma.staff.update({
      where: { id: staff.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await this.prisma.login_logs.create({
      data: {
        staffId: staff.id,
        username: dto.username,
        event: 'login',
        success: true,
        reason: 'Đăng nhập thành công',
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });

    const permissions = staff.roles.role_permissions.map((rp) => rp.permissions.code);

    const payload = {
      sub: staff.id,
      code: staff.code,
      name: staff.name,
      username: staff.username,
      role: staff.roles.code,
    };

    const token = await this.jwtService.signAsync(payload);

    return {
      accessToken: token,
      staff: {
        id: staff.id,
        code: staff.code,
        name: staff.name,
        phone: staff.phone,
        username: staff.username,
        role: staff.roles.code,
        roleName: staff.roles.name,
        mustChangePassword: staff.mustChangePassword,
      },
      permissions,
    };
  }

  async logout(staffId?: string, username?: string, ipAddress?: string, userAgent?: string) {
    if (staffId || username) {
      await this.prisma.login_logs.create({
        data: {
          staffId: staffId || null,
          username: username || 'unknown',
          event: 'logout',
          success: true,
          reason: 'Đăng xuất thành công',
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });
    }
    return { success: true, message: 'Đăng xuất thành công' };
  }

  async getDemoAccounts() {
    const accounts = await this.prisma.staff.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        code: true,
        name: true,
        username: true,
        roles: {
          select: { code: true, name: true },
        },
      },
      take: 6,
    });

    return accounts.map((a) => ({
      code: a.code,
      name: a.name,
      username: a.username,
      role: a.roles.code,
      roleName: a.roles.name,
      defaultPassword: 'TH@12345',
    }));
  }
}
