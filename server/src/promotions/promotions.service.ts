import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { ChangePromotionStatusDto } from './dto/change-promotion-status.dto';

const INCLUDE = {
  product_categories: { select: { code: true, name: true } },
  promotion_products: { select: { productId: true } },
} as const;

// Ngày 'YYYY-MM-DD' theo giờ Việt Nam: bắt đầu 00:00:00, kết thúc 23:59:59
const startOfDayVN = (d: string) => new Date(`${d}T00:00:00+07:00`);
const endOfDayVN = (d: string) => new Date(`${d}T23:59:59+07:00`);

@Injectable()
export class PromotionsService {
  constructor(private prisma: PrismaService) {}

  // Tự chuyển trạng thái theo thời gian:
  //  - Quá ngày kết thúc -> expired
  //  - Đã tới ngày bắt đầu (đang scheduled) -> active
  private async syncStatuses() {
    const now = new Date();
    await this.prisma.promotions.updateMany({
      where: { status: { in: ['scheduled', 'active', 'paused'] }, endDate: { lt: now } },
      data: { status: 'expired', statusChangedAt: now, updatedAt: now },
    });
    await this.prisma.promotions.updateMany({
      where: { status: 'scheduled', startDate: { lte: now }, endDate: { gte: now } },
      data: { status: 'active', statusChangedAt: now, updatedAt: now },
    });
  }

  async findAll() {
    await this.syncStatuses();
    return this.prisma.promotions.findMany({
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(staffId: string, dto: CreatePromotionDto) {
    const code = dto.code.trim().toUpperCase();
    if (!code) throw new BadRequestException('Mã khuyến mãi không được để trống');

    if (await this.prisma.promotions.findUnique({ where: { code } })) {
      throw new ConflictException('Mã khuyến mãi đã tồn tại');
    }

    if (dto.discountType === 'percentage' && dto.value > 100) {
      throw new BadRequestException('Giảm theo % không được vượt quá 100');
    }
    if (dto.discountType === 'fixed_amount' && dto.maxDiscountAmount != null) {
      throw new BadRequestException('Giảm tối đa chỉ áp dụng khi giảm theo %');
    }

    const startDate = startOfDayVN(dto.startDate);
    const endDate = endOfDayVN(dto.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Ngày áp dụng không hợp lệ');
    }
    if (endDate <= startDate) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }
    if (dto.activateNow && endDate < new Date()) {
      throw new BadRequestException('Chương trình đã quá hạn, không thể kích hoạt');
    }

    let categoryId: string | null = null;
    const productIds = [...new Set(dto.productIds ?? [])];

    if (dto.scope === 'category') {
      if (!dto.categoryCode) throw new BadRequestException('Vui lòng chọn nhóm hàng áp dụng');
      const cat = await this.prisma.category.findUnique({ where: { code: dto.categoryCode } });
      if (!cat) throw new BadRequestException('Nhóm hàng không tồn tại');
      categoryId = cat.id;
    }
    if (dto.scope === 'near_expiry' && !dto.nearExpiryDays) {
      throw new BadRequestException('Vui lòng nhập số ngày còn hạn dùng để xả hàng');
    }
    if (dto.scope === 'product') {
      if (productIds.length === 0) throw new BadRequestException('Vui lòng chọn ít nhất 1 sản phẩm áp dụng');
    }
    if (productIds.length > 0) {
      const found = await this.prisma.products.count({ where: { id: { in: productIds } } });
      if (found !== productIds.length) throw new BadRequestException('Có sản phẩm không tồn tại trong danh sách áp dụng');
    }

    const now = new Date();
    const status = dto.activateNow ? (startDate > now ? 'scheduled' : 'active') : 'draft';

    return this.prisma.promotions.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        scope: dto.scope,
        discountType: dto.discountType,
        value: dto.value,
        maxDiscountAmount: dto.discountType === 'percentage' ? dto.maxDiscountAmount ?? null : null,
        minOrderValue: dto.minOrderValue ?? 0,
        categoryId,
        nearExpiryDays: dto.scope === 'near_expiry' ? dto.nearExpiryDays : null,
        requiresCode: dto.requiresCode ?? false,
        usageLimit: dto.usageLimit ?? null,
        startDate,
        endDate,
        status,
        statusChangedAt: dto.activateNow ? now : null,
        createdById: staffId,
        promotion_products: {
          create: productIds.map((productId) => ({ productId })),
        },
      },
      include: INCLUDE,
    });
  }

  // Kích hoạt / tạm dừng / kết thúc và ghi nhận thời điểm thay đổi
  async changeStatus(id: string, dto: ChangePromotionStatusDto) {
    await this.syncStatuses();
    const promo = await this.prisma.promotions.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Không tìm thấy chương trình khuyến mãi');

    const now = new Date();
    let next: 'scheduled' | 'active' | 'paused' | 'expired';

    if (promo.status === 'expired') {
      throw new BadRequestException('Chương trình đã kết thúc, không thể thay đổi trạng thái');
    }

    if (dto.action === 'activate') {
      if (promo.status === 'active' || promo.status === 'scheduled') {
        throw new BadRequestException('Chương trình đã được kích hoạt');
      }
      if (promo.endDate < now) {
        throw new BadRequestException('Chương trình đã quá hạn, không thể kích hoạt');
      }
      next = promo.startDate > now ? 'scheduled' : 'active';
    } else if (dto.action === 'pause') {
      if (promo.status !== 'active' && promo.status !== 'scheduled') {
        throw new BadRequestException('Chỉ tạm dừng được chương trình đang chạy hoặc chờ áp dụng');
      }
      next = 'paused';
    } else {
      next = 'expired';
    }

    return this.prisma.promotions.update({
      where: { id },
      data: { status: next, statusChangedAt: now, updatedAt: now },
      include: INCLUDE,
    });
  }
}