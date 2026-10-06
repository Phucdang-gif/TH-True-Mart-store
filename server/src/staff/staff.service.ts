import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { PrismaService } from '../prisma/prisma.service';

const SALT_ROUNDS = 10;

// Thông báo thân thiện cho từng cột UNIQUE bị trùng
const UNIQUE_MESSAGES: Record<string, string> = {
  username: 'Tên đăng nhập đã tồn tại',
  code: 'Mã nhân viên đã tồn tại',
};

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  // Không bao giờ trả hash mật khẩu ra ngoài API
  private toSafe<T extends { password: string }>(staff: T): Omit<T, 'password'> {
    const { password, ...rest } = staff;
    return rest;
  }

  // Chuyển lỗi Prisma thành lỗi HTTP có ý nghĩa thay vì 500
  private handleError(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        const target = e.meta?.target as string[] | string | undefined;
        const field = Array.isArray(target) ? target[0] : target;
        throw new ConflictException(
          UNIQUE_MESSAGES[field ?? ''] ?? `${field} đã tồn tại`,
        );
      }
      if (e.code === 'P2025') {
        throw new NotFoundException('Không tìm thấy nhân viên');
      }
      if (e.code === 'P2003') {
        throw new ConflictException(
          'Nhân viên đã có dữ liệu liên quan (hóa đơn, ca thu ngân...), ' +
            'không thể xóa. Hãy chuyển trạng thái sang inactive.',
        );
      }
    }
    throw e;
  }

  async create(dto: CreateStaffDto) {
    try {
      const staff = await this.prisma.staff.create({
        data: {
          // Khai báo tường minh các trường từ frontend gửi lên
          name: dto.name,
          phone: dto.phone,
          username: dto.username,
          role: dto.role,
          shift: dto.shift,
          status: dto.status,
          password: await bcrypt.hash(dto.password, SALT_ROUNDS),
          passwordChangedAt: new Date(),
        },
      });
      return this.toSafe(staff);
    } catch (e) {
      this.handleError(e);
    }
  }

  async findAll() {
    const list = await this.prisma.staff.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return list.map((s) => this.toSafe(s));
  }

  async findOne(id: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new NotFoundException('Không tìm thấy nhân viên');
    return this.toSafe(staff);
  }

  async update(id: string, dto: UpdateStaffDto) {
    try {
      const { password, ...rest } = dto;
      const staff = await this.prisma.staff.update({
        where: { id },
        data: {
          ...rest,
          ...(password && {
            password: await bcrypt.hash(password, SALT_ROUNDS),
            passwordChangedAt: new Date(),
          }),
          // schema dùng @default(now()) chứ không phải @updatedAt
          // nên phải tự cập nhật
          updatedAt: new Date(),
        },
      });
      return this.toSafe(staff);
    } catch (e) {
      this.handleError(e);
    }
  }

  async remove(id: string) {
    try {
      const staff = await this.prisma.staff.delete({ where: { id } });
      return this.toSafe(staff);
    } catch (e) {
      // Ép kiểu an toàn: kiểm tra xem e có phải là lỗi Prisma và có mã P2003 không
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        const softDeletedStaff = await this.prisma.staff.update({
          where: { id },
          data: {
            status: 'inactive', // Vô hiệu hóa tài khoản
            updatedAt: new Date(),
          },
        });
        return this.toSafe(softDeletedStaff);
      }
      
      // Nếu không phải lỗi P2003, ném cho hàm handleError xử lý
      this.handleError(e);
    }
  }
}