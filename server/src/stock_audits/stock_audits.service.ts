import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockAuditStatus } from '@prisma/client';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { buildMeta, dateRange } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockAuditDto, StockAuditItemInputDto } from './dto/create-stock-audit.dto';
import { QueryStockAuditDto } from './dto/query-stock-audit.dto';
import { UpdateStockAuditDto } from './dto/update-stock-audit.dto';

const AUDIT_INCLUDE = {
  stock_audit_items: {
    include: {
      products: { select: { id: true, code: true, name: true, unit: true } },
    },
  },
  staff_stock_audits_performedByIdTostaff: { select: { id: true, code: true, name: true } },
  staff_stock_audits_approvedByIdTostaff: { select: { id: true, code: true, name: true } },
} satisfies Prisma.stock_auditsInclude;

type AuditWithRelations = Prisma.stock_auditsGetPayload<{ include: typeof AUDIT_INCLUDE }>;

@Injectable()
export class StockAuditsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── Helpers ─────────────────────────

  private toResponse(a: AuditWithRelations) {
    const {
      stock_audit_items,
      staff_stock_audits_performedByIdTostaff,
      staff_stock_audits_approvedByIdTostaff,
      ...rest
    } = a;
    return {
      ...rest,
      performedBy: staff_stock_audits_performedByIdTostaff,
      approvedBy: staff_stock_audits_approvedByIdTostaff,
      items: stock_audit_items.map(({ products, ...item }) => ({ ...item, product: products })),
    };
  }

  /** Tồn hệ thống hiện tại = tổng quantity các lô của sản phẩm */
  private async getSystemQuantities(
    db: Prisma.TransactionClient | PrismaService,
    productIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await db.batches.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
  }

  /** Chụp tồn hệ thống, tính chênh lệch cho từng dòng kiểm kê */
  private async buildItems(items: StockAuditItemInputDto[]) {
    const ids = items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Mỗi sản phẩm chỉ xuất hiện 1 lần trong phiếu kiểm kê');
    }

    const products = await this.prisma.products.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    if (products.length !== ids.length) throw new NotFoundException('Có sản phẩm không tồn tại');
    const nameById = new Map(products.map((p) => [p.id, p.name]));

    const system = await this.getSystemQuantities(this.prisma, ids);

    return items.map((i) => {
      const systemQuantity = system.get(i.productId) ?? 0;
      const difference = i.actualQuantity - systemQuantity;
      const reason = i.reason?.trim();
      if (difference !== 0 && !reason) {
        throw new BadRequestException(
          `Sản phẩm "${nameById.get(i.productId)}" lệch ${difference > 0 ? '+' : ''}${difference}, vui lòng nhập lý do`,
        );
      }
      return {
        productId: i.productId,
        systemQuantity,
        actualQuantity: i.actualQuantity,
        difference,
        reason: reason || 'Khớp số liệu',
      };
    });
  }

  private assertCanModify(audit: { performedById: string; status: StockAuditStatus }, user: AuthUser) {
    if (audit.status !== 'draft' && audit.status !== 'rejected') {
      throw new BadRequestException('Chỉ sửa / xoá được phiếu ở trạng thái nháp hoặc bị từ chối');
    }
    if (user.role !== 'manager' && audit.performedById !== user.id) {
      throw new ForbiddenException('Bạn chỉ được thao tác trên phiếu do mình lập');
    }
  }

  private async getOrFail(id: string) {
    const audit = await this.prisma.stock_audits.findUnique({ where: { id }, include: AUDIT_INCLUDE });
    if (!audit) throw new NotFoundException('Không tìm thấy phiếu kiểm kê');
    return audit;
  }

  // ───────────────────────── CRUD ─────────────────────────

  async create(dto: CreateStockAuditDto, user: AuthUser) {
    const items = await this.buildItems(dto.items);
    const created = await this.prisma.stock_audits.create({
      data: {
        performedById: user.id,
        ...(dto.auditDate && { auditDate: new Date(dto.auditDate) }),
        stock_audit_items: { createMany: { data: items } },
      },
      include: AUDIT_INCLUDE,
    });
    return this.toResponse(created);
  }

  async findAll(query: QueryStockAuditDto) {
    const { page, limit, search, status, performedById, from, to, sortBy, sortOrder } = query;
    const range = dateRange(from, to);

    const where: Prisma.stock_auditsWhereInput = {
      ...(status && { status }),
      ...(performedById && { performedById }),
      ...(range && { auditDate: range }),
      ...(search && { auditCode: { contains: search, mode: 'insensitive' } }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stock_audits.findMany({
        where,
        include: AUDIT_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stock_audits.count({ where }),
    ]);
    return { data: rows.map((r) => this.toResponse(r)), meta: buildMeta(total, page, limit) };
  }

  async findOne(id: string) {
    return this.toResponse(await this.getOrFail(id));
  }

  /** Sửa phiếu nháp / bị từ chối: tính lại tồn hệ thống, phiếu bị từ chối quay về nháp */
  async update(id: string, dto: UpdateStockAuditDto, user: AuthUser) {
    if (dto.items === undefined && dto.auditDate === undefined) {
      throw new BadRequestException('Không có trường nào để cập nhật');
    }
    const audit = await this.getOrFail(id);
    this.assertCanModify(audit, user);

    const items = dto.items ? await this.buildItems(dto.items) : null;

    await this.prisma.stock_audits.update({
      where: { id },
      data: {
        status: 'draft',
        approvedById: null,
        ...(dto.auditDate && { auditDate: new Date(dto.auditDate) }),
        ...(items && {
          stock_audit_items: { deleteMany: {}, createMany: { data: items } },
        }),
      },
    });
    return this.findOne(id);
  }

  async remove(id: string, user: AuthUser) {
    const audit = await this.getOrFail(id);
    this.assertCanModify(audit, user);
    await this.prisma.stock_audits.delete({ where: { id } });
    return { id, auditCode: audit.auditCode, deleted: true };
  }

  // ───────────────────────── Quy trình duyệt ─────────────────────────

  /** Nhân viên kho gửi phiếu chờ quản lý duyệt */
  async submit(id: string, user: AuthUser) {
    const audit = await this.getOrFail(id);
    if (audit.status !== 'draft') {
      throw new BadRequestException('Chỉ gửi duyệt được phiếu ở trạng thái nháp');
    }
    if (user.role !== 'manager' && audit.performedById !== user.id) {
      throw new ForbiddenException('Bạn chỉ được gửi duyệt phiếu do mình lập');
    }
    if (audit.stock_audit_items.length === 0) {
      throw new BadRequestException('Phiếu chưa có dòng kiểm kê nào');
    }
    await this.prisma.stock_audits.update({ where: { id }, data: { status: 'pending_approval' } });
    return this.findOne(id);
  }

  /**
   * Quản lý duyệt: áp chênh lệch (difference) vào tồn kho các lô.
   *  - Thiếu (âm): trừ theo FEFO (lô hết hạn trước trừ trước).
   *  - Thừa (dương): cộng vào lô còn hạn có hạn dùng xa nhất (nếu không còn lô nào còn hạn thì lô mới nhất).
   * Áp theo chênh lệch chứ không ghi đè tồn, để không mất các giao dịch bán phát sinh sau lúc đếm.
   */
  async approve(id: string, user: AuthUser) {
    const audit = await this.getOrFail(id);
    if (audit.status !== 'pending_approval') {
      throw new BadRequestException('Chỉ duyệt được phiếu đang chờ duyệt');
    }

    await this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.stock_audits.updateMany({
          where: { id, status: 'pending_approval' },
          data: { status: 'approved', approvedById: user.id },
        });
        if (claimed.count !== 1) throw new ConflictException('Phiếu vừa được xử lý bởi người khác');

        for (const item of audit.stock_audit_items) {
          if (item.difference !== 0) {
            await this.applyAdjustment(tx, item.productId, item.products.name, item.difference);
          }
        }
      },
      { timeout: 15000 },
    );
    return this.findOne(id);
  }

  async reject(id: string, user: AuthUser) {
    const audit = await this.getOrFail(id);
    if (audit.status !== 'pending_approval') {
      throw new BadRequestException('Chỉ từ chối được phiếu đang chờ duyệt');
    }
    await this.prisma.stock_audits.update({
      where: { id },
      data: { status: 'rejected', approvedById: user.id },
    });
    return this.findOne(id);
  }

  private async applyAdjustment(
    tx: Prisma.TransactionClient,
    productId: string,
    productName: string,
    difference: number,
  ) {
    if (difference > 0) {
      const now = new Date();
      const target =
        (await tx.batches.findFirst({
          where: { productId, expiryDate: { gt: now } },
          orderBy: { expiryDate: 'desc' },
        })) ??
        (await tx.batches.findFirst({ where: { productId }, orderBy: { createdAt: 'desc' } }));
      if (!target) {
        throw new BadRequestException(
          `Sản phẩm "${productName}" chưa có lô nào để cộng phần thừa, hãy nhập kho trước`,
        );
      }
      await tx.batches.update({ where: { id: target.id }, data: { quantity: { increment: difference } } });
      return;
    }

    let remaining = -difference;
    const batches = await tx.batches.findMany({
      where: { productId, quantity: { gt: 0 } },
      orderBy: { expiryDate: 'asc' },
    });
    for (const b of batches) {
      if (remaining === 0) break;
      const take = Math.min(b.quantity, remaining);
      const res = await tx.batches.updateMany({
        where: { id: b.id, quantity: { gte: take } },
        data: { quantity: { decrement: take } },
      });
      if (res.count !== 1) throw new ConflictException('Tồn kho vừa thay đổi, vui lòng thử duyệt lại');
      remaining -= take;
    }
    if (remaining > 0) {
      throw new ConflictException(
        `Tồn hiện tại của "${productName}" không đủ để trừ phần thiếu (thiếu thêm ${remaining}). ` +
          'Hãy từ chối phiếu và kiểm kê lại',
      );
    }
  }
}
