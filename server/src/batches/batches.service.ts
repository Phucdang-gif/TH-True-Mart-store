import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BatchStatus, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { QueryBatchDto } from './dto/query-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';

/** Lô còn <= số ngày này đến hạn thì coi là `expiring_soon` */
export const EXPIRING_SOON_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

const BATCH_INCLUDE = {
  products: {
    select: { id: true, code: true, name: true, unit: true, category: true },
  },
  staff: { select: { id: true, code: true, name: true } },
} satisfies Prisma.batchesInclude;

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── Helpers ─────────────────────────

  /** Tính status từ hạn dùng. */
  computeStatus(expiryDate: Date, now = new Date()): BatchStatus {
    if (expiryDate.getTime() <= now.getTime()) return BatchStatus.expired;
    if (expiryDate.getTime() <= addDays(now, EXPIRING_SOON_DAYS).getTime()) {
      return BatchStatus.expiring_soon;
    }
    return BatchStatus.good;
  }

  private assertDates(manufacturingDate: Date, expiryDate: Date) {
    // Cho dư 1 ngày để tránh lệch múi giờ khi client gửi "hôm nay"
    if (manufacturingDate.getTime() > addDays(new Date(), 1).getTime()) {
      throw new BadRequestException('Ngày sản xuất không được ở tương lai');
    }
    if (expiryDate.getTime() <= manufacturingDate.getTime()) {
      throw new BadRequestException('Hạn sử dụng phải sau ngày sản xuất');
    }
  }

  private generateBatchCode(productCode: string) {
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = randomBytes(2).toString('hex').toUpperCase();
    return `LO-${productCode}-${ymd}-${rand}`;
  }

  private isUniqueViolation(e: unknown) {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
  }

  // ───────────────────────── CRUD ─────────────────────────

  async create(dto: CreateBatchDto) {
    const product = await this.prisma.products.findUnique({
      where: { id: dto.productId },
      select: { id: true, code: true, name: true, status: true },
    });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    if (product.status !== ProductStatus.active) {
      throw new BadRequestException(`Sản phẩm "${product.name}" đã ngừng kinh doanh`);
    }

    if (dto.receivedById) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: dto.receivedById },
        select: { id: true },
      });
      if (!staff) throw new NotFoundException('Không tìm thấy nhân viên nhận hàng');
    }

    const manufacturingDate = new Date(dto.manufacturingDate);
    const expiryDate = new Date(dto.expiryDate);
    this.assertDates(manufacturingDate, expiryDate);
    if (expiryDate.getTime() <= Date.now()) {
      throw new BadRequestException('Lô hàng đã hết hạn, không thể nhập kho');
    }

    const buildData = (batchCode: string): Prisma.batchesUncheckedCreateInput => ({
      batchCode,
      productId: dto.productId,
      manufacturingDate,
      expiryDate,
      quantity: dto.quantity,
      importPrice: new Prisma.Decimal(dto.importPrice),
      status: this.computeStatus(expiryDate),
      receivedById: dto.receivedById,
    });

    // Client tự đặt mã: trùng thì báo lỗi luôn
    if (dto.batchCode) {
      try {
        return await this.prisma.batches.create({
          data: buildData(dto.batchCode),
          include: BATCH_INCLUDE,
        });
      } catch (e) {
        if (this.isUniqueViolation(e)) {
          throw new ConflictException(`Mã lô "${dto.batchCode}" đã tồn tại`);
        }
        throw e;
      }
    }

    // Server tự sinh mã: trùng (rất hiếm) thì sinh lại
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.batches.create({
          data: buildData(this.generateBatchCode(product.code)),
          include: BATCH_INCLUDE,
        });
      } catch (e) {
        if (!this.isUniqueViolation(e)) throw e;
      }
    }
    throw new ConflictException('Không thể sinh mã lô duy nhất, vui lòng thử lại');
  }

  async findAll(query: QueryBatchDto) {
    const {
      page, limit, productId, status, receivedById, search, inStockOnly,
      expiryFrom, expiryTo, expiringWithinDays, sortBy, sortOrder,
    } = query;

    const expiry: Prisma.DateTimeFilter = {};
    if (expiryFrom) expiry.gte = new Date(expiryFrom);
    if (expiryTo) expiry.lte = new Date(expiryTo);
    if (expiringWithinDays !== undefined) {
      const now = new Date();
      expiry.gt = now;
      expiry.lte = addDays(now, expiringWithinDays);
    }

    const where: Prisma.batchesWhereInput = {
      ...(productId && { productId }),
      ...(status && { status }),
      ...(receivedById && { receivedById }),
      ...(inStockOnly && { quantity: { gt: 0 } }),
      ...(Object.keys(expiry).length > 0 && { expiryDate: expiry }),
      ...(search && {
        OR: [
          { batchCode: { contains: search, mode: 'insensitive' } },
          { products: { name: { contains: search, mode: 'insensitive' } } },
          { products: { code: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.batches.findMany({
        where,
        include: BATCH_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.batches.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const batch = await this.prisma.batches.findUnique({
      where: { id },
      include: BATCH_INCLUDE,
    });
    if (!batch) throw new NotFoundException('Không tìm thấy lô hàng');
    return batch;
  }

  /**
   * Các lô còn bán được của 1 sản phẩm, xếp theo FEFO (hết hạn trước, xuất trước).
   * Dùng cho POS / module invoices khi chọn lô.
   */
  async findAvailableByProduct(productId: string) {
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');

    const data = await this.prisma.batches.findMany({
      where: {
        productId,
        quantity: { gt: 0 },
        expiryDate: { gt: new Date() },
      },
      include: BATCH_INCLUDE,
      orderBy: { expiryDate: 'asc' },
    });

    return {
      data,
      totalQuantity: data.reduce((sum, b) => sum + b.quantity, 0),
    };
  }

  async update(id: string, dto: UpdateBatchDto) {
    if (Object.values(dto).every((v) => v === undefined)) {
      throw new BadRequestException('Không có trường nào để cập nhật');
    }

    const current = await this.prisma.batches.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không tìm thấy lô hàng');

    const manufacturingDate = dto.manufacturingDate
      ? new Date(dto.manufacturingDate)
      : current.manufacturingDate;
    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : current.expiryDate;
    this.assertDates(manufacturingDate, expiryDate);

    return this.prisma.batches.update({
      where: { id },
      data: {
        manufacturingDate,
        expiryDate,
        status: this.computeStatus(expiryDate),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.importPrice !== undefined && {
          importPrice: new Prisma.Decimal(dto.importPrice),
        }),
      },
      include: BATCH_INCLUDE,
    });
  }

  async remove(id: string) {
    const batch = await this.prisma.batches.findUnique({
      where: { id },
      select: {
        id: true,
        batchCode: true,
        _count: { select: { invoice_items: true } },
      },
    });
    if (!batch) throw new NotFoundException('Không tìm thấy lô hàng');

    if (batch._count.invoice_items > 0) {
      throw new BadRequestException(
        `Lô ${batch.batchCode} đã phát sinh bán hàng nên không thể xoá. ` +
          'Hãy điều chỉnh số lượng về 0 nếu cần loại khỏi kho',
      );
    }

    await this.prisma.batches.delete({ where: { id } });
    return { id, batchCode: batch.batchCode, deleted: true };
  }

  // ───────────────────────── Đồng bộ trạng thái ─────────────────────────

  /**
   * Cập nhật lại status của toàn bộ lô theo hạn dùng hiện tại.
   * Gọi thủ công qua POST /batches/refresh-status, hoặc gắn @Cron (cần @nestjs/schedule)
   * để chạy mỗi ngày.
   */
  async syncStatuses() {
    const now = new Date();
    const soon = addDays(now, EXPIRING_SOON_DAYS);

    const [expired, expiringSoon, good] = await this.prisma.$transaction([
      this.prisma.batches.updateMany({
        where: { expiryDate: { lte: now }, status: { not: BatchStatus.expired } },
        data: { status: BatchStatus.expired },
      }),
      this.prisma.batches.updateMany({
        where: {
          expiryDate: { gt: now, lte: soon },
          status: { not: BatchStatus.expiring_soon },
        },
        data: { status: BatchStatus.expiring_soon },
      }),
      this.prisma.batches.updateMany({
        where: { expiryDate: { gt: soon }, status: { not: BatchStatus.good } },
        data: { status: BatchStatus.good },
      }),
    ]);

    return {
      updated: {
        expired: expired.count,
        expiring_soon: expiringSoon.count,
        good: good.count,
      },
    };
  }
}