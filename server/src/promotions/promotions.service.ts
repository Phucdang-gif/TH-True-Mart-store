import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma, PromotionScope, PromotionStatus } from '@prisma/client';
import { buildMeta, formatVnd, isUniqueViolation } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { QueryPromotionDto } from './dto/query-promotion.dto';
import { UpdatePromotionStatusDto } from './dto/update-promotion-status.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { calcPromotionDiscount, getPromotionBlockReason } from './promotion.utils';

const PROMO_INCLUDE = {
  promotion_products: { select: { productId: true } },
} satisfies Prisma.promotionsInclude;

/** Các bước chuyển trạng thái hợp lệ do quản lý thao tác */
const STATUS_TRANSITIONS: Record<PromotionStatus, PromotionStatus[]> = {
  draft: ['scheduled', 'active'],
  scheduled: ['draft', 'active', 'paused'],
  active: ['paused', 'expired'],
  paused: ['active', 'scheduled', 'expired'],
  expired: ['draft'],
};

interface PromotionRules {
  scope: PromotionScope;
  discountType: 'percentage' | 'fixed_amount';
  value: number;
  startDate: Date;
  endDate: Date;
  applicableCategory: Category | null;
  nearExpiryDays: number | null;
  productCount: number;
}

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── Helpers ─────────────────────────

  /** Trả về dạng frontend dùng: gộp promotion_products thành productIds */
  private toResponse<T extends { promotion_products: { productId: string }[] }>(p: T) {
    const { promotion_products, ...rest } = p;
    return { ...rest, productIds: promotion_products.map((x) => x.productId) };
  }

  private assertRules(r: PromotionRules) {
    if (r.endDate.getTime() <= r.startDate.getTime()) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }
    if (r.discountType === 'percentage' && r.value > 100) {
      throw new BadRequestException('Giảm theo % không được vượt quá 100');
    }
    if (r.scope === 'category' && !r.applicableCategory) {
      throw new BadRequestException('Phạm vi "theo nhóm hàng" cần chọn applicableCategory');
    }
    if (r.scope === 'product' && r.productCount === 0) {
      throw new BadRequestException('Phạm vi "theo sản phẩm" cần ít nhất 1 sản phẩm (productIds)');
    }
    if (r.scope === 'near_expiry' && !r.nearExpiryDays) {
      throw new BadRequestException('Phạm vi "cận date" cần nearExpiryDays');
    }
  }

  private async assertProductsExist(productIds: string[]) {
    if (productIds.length === 0) return;
    const count = await this.prisma.products.count({ where: { id: { in: productIds } } });
    if (count !== productIds.length) {
      throw new NotFoundException('Có sản phẩm trong productIds không tồn tại');
    }
  }

  // ───────────────────────── CRUD ─────────────────────────

  async create(dto: CreatePromotionDto, createdById: string) {
    const scope = dto.scope ?? 'order';
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const usesProducts = scope === 'product' || scope === 'near_expiry';
    const productIds = usesProducts ? (dto.productIds ?? []) : [];

    this.assertRules({
      scope,
      discountType: dto.discountType,
      value: dto.value,
      startDate,
      endDate,
      applicableCategory: dto.applicableCategory ?? null,
      nearExpiryDays: dto.nearExpiryDays ?? null,
      productCount: productIds.length,
    });
    if ((dto.status ?? 'scheduled') === 'active' && endDate.getTime() <= Date.now()) {
      throw new BadRequestException('Không thể kích hoạt chương trình đã quá ngày kết thúc');
    }
    await this.assertProductsExist(productIds);

    try {
      const created = await this.prisma.promotions.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          scope,
          discountType: dto.discountType,
          value: new Prisma.Decimal(dto.value),
          maxDiscountAmount:
            dto.discountType === 'percentage' && dto.maxDiscountAmount !== undefined
              ? new Prisma.Decimal(dto.maxDiscountAmount)
              : null,
          startDate,
          endDate,
          minOrderValue: new Prisma.Decimal(dto.minOrderValue ?? 0),
          applicableCategory: scope === 'category' ? dto.applicableCategory : null,
          nearExpiryDays: scope === 'near_expiry' ? dto.nearExpiryDays : null,
          requiresCode: dto.requiresCode ?? false,
          usageLimit: dto.usageLimit,
          ...(dto.status && { status: dto.status }),
          createdById,
          ...(productIds.length > 0 && {
            promotion_products: { createMany: { data: productIds.map((productId) => ({ productId })) } },
          }),
        },
        include: PROMO_INCLUDE,
      });
      return this.toResponse(created);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException(`Mã "${dto.code}" đã tồn tại`);
      throw e;
    }
  }

  async findAll(query: QueryPromotionDto) {
    const { page, limit, search, status, scope, discountType, requiresCode, activeNow, sortBy, sortOrder } = query;
    const now = new Date();

    const where: Prisma.promotionsWhereInput = {
      ...(status && { status }),
      ...(scope && { scope }),
      ...(discountType && { discountType }),
      ...(requiresCode !== undefined && { requiresCode }),
      ...(activeNow && { status: 'active', startDate: { lte: now }, endDate: { gte: now } }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.promotions.findMany({
        where,
        include: PROMO_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.promotions.count({ where }),
    ]);

    return { data: rows.map((r) => this.toResponse(r)), meta: buildMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const promo = await this.prisma.promotions.findUnique({ where: { id }, include: PROMO_INCLUDE });
    if (!promo) throw new NotFoundException('Không tìm thấy chương trình khuyến mãi');
    return this.toResponse(promo);
  }

  async update(id: string, dto: UpdatePromotionDto) {
    if (Object.values(dto).every((v) => v === undefined)) {
      throw new BadRequestException('Không có trường nào để cập nhật');
    }
    const current = await this.prisma.promotions.findUnique({ where: { id }, include: PROMO_INCLUDE });
    if (!current) throw new NotFoundException('Không tìm thấy chương trình khuyến mãi');

    if (dto.code !== undefined && dto.code !== current.code && current.usedCount > 0) {
      throw new BadRequestException('Mã đã được dùng trên hóa đơn nên không thể đổi');
    }

    const scope = dto.scope ?? current.scope;
    const discountType = dto.discountType ?? current.discountType;
    const value = dto.value ?? Number(current.value);
    const startDate = dto.startDate ? new Date(dto.startDate) : current.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : current.endDate;
    const usesProducts = scope === 'product' || scope === 'near_expiry';
    const productIds = usesProducts
      ? (dto.productIds ?? current.promotion_products.map((x) => x.productId))
      : [];
    const applicableCategory = scope === 'category' ? (dto.applicableCategory ?? current.applicableCategory) : null;
    const nearExpiryDays = scope === 'near_expiry' ? (dto.nearExpiryDays ?? current.nearExpiryDays) : null;
    const usageLimit = dto.usageLimit ?? current.usageLimit;

    this.assertRules({
      scope, discountType, value, startDate, endDate, applicableCategory, nearExpiryDays,
      productCount: productIds.length,
    });
    if (usageLimit !== null && usageLimit < current.usedCount) {
      throw new BadRequestException(`usageLimit không được nhỏ hơn số lượt đã dùng (${current.usedCount})`);
    }
    await this.assertProductsExist(productIds);

    const maxDiscountAmount =
      discountType === 'percentage'
        ? dto.maxDiscountAmount !== undefined
          ? new Prisma.Decimal(dto.maxDiscountAmount)
          : current.maxDiscountAmount
        : null;

    try {
      const updated = await this.prisma.promotions.update({
        where: { id },
        data: {
          code: dto.code ?? current.code,
          name: dto.name ?? current.name,
          description: dto.description ?? current.description,
          scope,
          discountType,
          value: new Prisma.Decimal(value),
          maxDiscountAmount,
          startDate,
          endDate,
          minOrderValue:
            dto.minOrderValue !== undefined ? new Prisma.Decimal(dto.minOrderValue) : current.minOrderValue,
          applicableCategory,
          nearExpiryDays,
          requiresCode: dto.requiresCode ?? current.requiresCode,
          usageLimit,
          updatedAt: new Date(),
          promotion_products: {
            deleteMany: {},
            ...(productIds.length > 0 && {
              createMany: { data: productIds.map((productId) => ({ productId })) },
            }),
          },
        },
        include: PROMO_INCLUDE,
      });
      return this.toResponse(updated);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException(`Mã "${dto.code}" đã tồn tại`);
      throw e;
    }
  }

  async updateStatus(id: string, dto: UpdatePromotionStatusDto) {
    const current = await this.prisma.promotions.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không tìm thấy chương trình khuyến mãi');
    if (current.status === dto.status) return this.findOne(id);

    if (!STATUS_TRANSITIONS[current.status].includes(dto.status)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ "${current.status}" sang "${dto.status}"`,
      );
    }
    if (
      (dto.status === 'active' || dto.status === 'scheduled') &&
      current.endDate.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Chương trình đã quá ngày kết thúc, hãy gia hạn endDate trước');
    }

    await this.prisma.promotions.update({
      where: { id },
      data: { status: dto.status, updatedAt: new Date() },
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    const promo = await this.prisma.promotions.findUnique({
      where: { id },
      select: { id: true, code: true, _count: { select: { invoice_promotions: true } } },
    });
    if (!promo) throw new NotFoundException('Không tìm thấy chương trình khuyến mãi');
    if (promo._count.invoice_promotions > 0) {
      throw new BadRequestException(
        `Chương trình ${promo.code} đã được áp dụng trên hóa đơn nên không thể xoá. ` +
          'Hãy chuyển sang trạng thái "paused" hoặc "expired"',
      );
    }
    await this.prisma.promotions.delete({ where: { id } });
    return { id, code: promo.code, deleted: true };
  }

  // ───────────────────────── Nghiệp vụ ─────────────────────────

  /** Thu ngân nhập mã voucher ở POS: kiểm tra mã còn dùng được không */
  async validateCode(code: string, orderValue?: number) {
    const promo = await this.prisma.promotions.findFirst({
      where: { code: { equals: code.trim(), mode: 'insensitive' } },
      include: PROMO_INCLUDE,
    });
    if (!promo) throw new NotFoundException('Mã khuyến mãi không tồn tại');
    if (!promo.requiresCode) {
      throw new BadRequestException('Đây là chương trình tự động áp dụng, không cần nhập mã');
    }
    const reason = getPromotionBlockReason(promo);
    if (reason) throw new BadRequestException(reason);

    if (orderValue !== undefined && new Prisma.Decimal(orderValue).lt(promo.minOrderValue)) {
      throw new BadRequestException(
        `Đơn hàng phải từ ${formatVnd(promo.minOrderValue)} đ để áp dụng mã này`,
      );
    }

    // Chỉ ước tính chính xác được với scope = order; các scope khác phụ thuộc giỏ hàng
    const estimatedDiscount =
      orderValue !== undefined && promo.scope === 'order'
        ? calcPromotionDiscount(promo, new Prisma.Decimal(orderValue))
        : null;

    return { valid: true, promotion: this.toResponse(promo), estimatedDiscount };
  }

  /**
   * Đồng bộ trạng thái theo ngày hiệu lực:
   *  - scheduled đã đến ngày bắt đầu (và chưa hết hạn) -> active
   *  - active / scheduled / paused đã quá ngày kết thúc -> expired
   * Gọi qua POST /promotions/refresh-status hoặc gắn @Cron (cần @nestjs/schedule).
   */
  async syncStatuses() {
    const now = new Date();
    const [activated, expired] = await this.prisma.$transaction([
      this.prisma.promotions.updateMany({
        where: { status: 'scheduled', startDate: { lte: now }, endDate: { gte: now } },
        data: { status: 'active', updatedAt: now },
      }),
      this.prisma.promotions.updateMany({
        where: { status: { in: ['scheduled', 'active', 'paused'] }, endDate: { lt: now } },
        data: { status: 'expired', updatedAt: now },
      }),
    ]);
    return { updated: { activated: activated.count, expired: expired.count } };
  }
}
