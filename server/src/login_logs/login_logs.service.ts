import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildMeta, dateRange } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { QueryLoginLogDto } from './dto/query-login-log.dto';

const STAFF_SELECT = { select: { id: true, code: true, name: true } } as const;

/** Nhật ký đăng nhập là dữ liệu kiểm toán: chỉ đọc, không sửa/xoá qua API. */
@Injectable()
export class LoginLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryLoginLogDto) {
    const { page, limit, staffId, username, success, from, to, sortOrder } = query;
    const range = dateRange(from, to);

    const where: Prisma.login_logsWhereInput = {
      ...(staffId && { staffId }),
      ...(username && { username: { contains: username, mode: 'insensitive' } }),
      ...(success !== undefined && { success }),
      ...(range && { createdAt: range }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.login_logs.findMany({
        where,
        include: { staff: STAFF_SELECT },
        orderBy: { createdAt: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.login_logs.count({ where }),
    ]);
    return { data, meta: buildMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const log = await this.prisma.login_logs.findUnique({ where: { id }, include: { staff: STAFF_SELECT } });
    if (!log) throw new NotFoundException('Không tìm thấy nhật ký đăng nhập');
    return log;
  }
}
