import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { buildMeta, dateRange, isUniqueViolation, vnDateStamp } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
import { QueryCashSessionDto } from './dto/query-cash-session.dto';

const SESSION_INCLUDE = {
  staff_cash_sessions_cashierIdTostaff: { select: { id: true, code: true, name: true } },
  staff_cash_sessions_reviewedByIdTostaff: { select: { id: true, code: true, name: true } },
} satisfies Prisma.cash_sessionsInclude;

type SessionWithRelations = Prisma.cash_sessionsGetPayload<{ include: typeof SESSION_INCLUDE }>;

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class CashSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── Helpers ─────────────────────────

  private toResponse(s: SessionWithRelations) {
    const {
      staff_cash_sessions_cashierIdTostaff,
      staff_cash_sessions_reviewedByIdTostaff,
      ...rest
    } = s;
    return {
      ...rest,
      cashier: staff_cash_sessions_cashierIdTostaff,
      reviewedBy: staff_cash_sessions_reviewedByIdTostaff,
    };
  }

  /** CA-YYYYMMDD-NNN (theo ngày giờ VN). `offset` dùng khi retry do trùng mã. */
  private async generateCode(offset: number) {
    const prefix = `CA-${vnDateStamp()}-`;
    const count = await this.prisma.cash_sessions.count({ where: { code: { startsWith: prefix } } });
    return `${prefix}${String(count + 1 + offset).padStart(3, '0')}`;
  }

  private assertCanView(session: { cashierId: string }, user: AuthUser) {
    if (user.role !== 'manager' && session.cashierId !== user.id) {
      throw new ForbiddenException('Bạn chỉ được xem ca của chính mình');
    }
  }

  /**
   * Tổng hợp tiền của ca:
   *  - Doanh thu theo hình thức: các khoản thanh toán đã xác nhận của hóa đơn thuộc ca (đã trừ tiền thối).
   *  - Tiền mặt hoàn: invoice_approvals (refundMethod = cash) của các hóa đơn thuộc ca.
   *  - expectedCash = openingCash + thu tiền mặt - hoàn tiền mặt.
   * Lưu ý: hoàn tiền cho hóa đơn của ca khác (vd trả hàng hôm sau) không tính vào ca này.
   */
  private async computeSummary(session: { id: string; openingCash: Prisma.Decimal }) {
    const [payments, refunds, invoiceCount] = await Promise.all([
      this.prisma.invoice_payments.groupBy({
        by: ['method'],
        where: { status: 'confirmed', invoices: { cashSessionId: session.id } },
        _sum: { amount: true },
      }),
      this.prisma.invoice_approvals.aggregate({
        where: { refundMethod: 'cash', invoices: { cashSessionId: session.id } },
        _sum: { refundAmount: true },
      }),
      this.prisma.invoices.count({ where: { cashSessionId: session.id } }),
    ]);

    const byMethod = (m: string) => payments.find((p) => p.method === m)?._sum.amount ?? ZERO;
    const cashSales = byMethod('cash');
    const cashRefunds = refunds._sum.refundAmount ?? ZERO;

    return {
      invoiceCount,
      cashSales,
      transferSales: byMethod('transfer'),
      cardSales: byMethod('card'),
      cashRefunds,
      expectedCash: session.openingCash.plus(cashSales).minus(cashRefunds),
    };
  }

  // ───────────────────────── CRUD / nghiệp vụ ─────────────────────────

  /** Mở ca: mỗi thu ngân chỉ có 1 ca đang mở */
  async open(user: AuthUser, dto: OpenCashSessionDto) {
    const existing = await this.prisma.cash_sessions.findFirst({
      where: { cashierId: user.id, status: 'open' },
      select: { code: true },
    });
    if (existing) throw new ConflictException(`Bạn đang có ca ${existing.code} chưa kết ca`);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const created = await this.prisma.cash_sessions.create({
          data: {
            code: await this.generateCode(attempt),
            cashierId: user.id,
            openingCash: new Prisma.Decimal(dto.openingCash ?? 0),
          },
          include: SESSION_INCLUDE,
        });
        return this.toResponse(created);
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
      }
    }
    throw new ConflictException('Không thể sinh mã ca duy nhất, vui lòng thử lại');
  }

  /** Ca đang mở của người dùng hiện tại (null nếu chưa mở) */
  async findCurrent(user: AuthUser) {
    const session = await this.prisma.cash_sessions.findFirst({
      where: { cashierId: user.id, status: 'open' },
      include: SESSION_INCLUDE,
    });
    if (!session) return null;
    return { ...this.toResponse(session), summary: await this.computeSummary(session) };
  }

  async findAll(query: QueryCashSessionDto, user: AuthUser) {
    const { page, limit, status, cashierId, from, to, sortBy, sortOrder } = query;
    const range = dateRange(from, to);

    const where: Prisma.cash_sessionsWhereInput = {
      ...(status && { status }),
      ...(user.role === 'manager' ? cashierId && { cashierId } : { cashierId: user.id }),
      ...(range && { openedAt: range }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.cash_sessions.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.cash_sessions.count({ where }),
    ]);
    return { data: rows.map((r) => this.toResponse(r)), meta: buildMeta(total, page, limit) };
  }

  async findOne(id: string, user: AuthUser) {
    const session = await this.prisma.cash_sessions.findUnique({ where: { id }, include: SESSION_INCLUDE });
    if (!session) throw new NotFoundException('Không tìm thấy ca thu ngân');
    this.assertCanView(session, user);
    return { ...this.toResponse(session), summary: await this.computeSummary(session) };
  }

  /** Kết ca: hệ thống tính expectedCash, thu ngân nhập countedCash, lệch thì phải ghi lý do */
  async close(id: string, dto: CloseCashSessionDto, user: AuthUser) {
    const session = await this.prisma.cash_sessions.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Không tìm thấy ca thu ngân');
    this.assertCanView(session, user);
    if (session.status !== 'open') throw new BadRequestException('Ca này đã được kết');

    const summary = await this.computeSummary(session);
    const counted = new Prisma.Decimal(dto.countedCash);
    const difference = counted.minus(summary.expectedCash);
    const reason = dto.differenceReason?.trim();

    if (!difference.isZero() && !reason) {
      throw new BadRequestException(
        `Tiền đếm lệch ${difference.toFixed(0)} đ so với hệ thống (${summary.expectedCash.toFixed(0)} đ), vui lòng nhập lý do`,
      );
    }

    // Chặn kết ca khi còn hóa đơn chờ thanh toán / chờ duyệt
    const pending = await this.prisma.invoices.count({
      where: { cashSessionId: id, status: { in: ['pending_payment', 'pending_approval'] } },
    });
    if (pending > 0) {
      throw new BadRequestException(`Còn ${pending} hóa đơn chờ thanh toán / chờ duyệt trong ca`);
    }

    const closed = await this.prisma.cash_sessions.updateMany({
      where: { id, status: 'open' },
      data: {
        status: 'closed',
        closedAt: new Date(),
        expectedCash: summary.expectedCash,
        countedCash: counted,
        difference,
        differenceReason: reason || null,
      },
    });
    if (closed.count !== 1) throw new ConflictException('Ca vừa được kết bởi thao tác khác');
    return this.findOne(id, user);
  }

  /** Quản lý duyệt ca đã kết (xác nhận chênh lệch nếu có) */
  async review(id: string, user: AuthUser) {
    const session = await this.prisma.cash_sessions.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Không tìm thấy ca thu ngân');
    if (session.status !== 'closed') {
      throw new BadRequestException('Chỉ duyệt được ca đã kết và chưa duyệt');
    }
    const reviewed = await this.prisma.cash_sessions.updateMany({
      where: { id, status: 'closed' },
      data: { status: 'reviewed', reviewedById: user.id },
    });
    if (reviewed.count !== 1) throw new ConflictException('Ca vừa được duyệt bởi thao tác khác');
    return this.findOne(id, user);
  }
}
