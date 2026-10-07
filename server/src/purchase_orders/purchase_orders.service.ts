import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseOrderStatus, SupplierStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ITEM_INCLUDE,
  PurchaseOrderItemsService,
} from '../purchase_order_items/purchase_order_items.service'
import { CreatePurchaseOrderDto } from '../purchase_orders/dto/create-purchase_order.dto';
import { QueryPurchaseOrderDto } from '../purchase_orders/dto/query-purchase_order.dto';
import { UpdatePurchaseOrderStatusDto } from '../purchase_orders/dto/update-purchase_order-status.dto';
import { UpdatePurchaseOrderDto } from '../purchase_orders/dto/update-purchase_order.dto';

const SUPPLIER_SELECT = {
  select: { id: true, code: true, name: true, phone: true },
} as const;

const DETAIL_INCLUDE = {
  suppliers: SUPPLIER_SELECT,
  purchase_order_items: { include: ITEM_INCLUDE },
} satisfies Prisma.purchase_ordersInclude;

const LIST_INCLUDE = {
  suppliers: SUPPLIER_SELECT,
  _count: { select: { purchase_order_items: true } },
} satisfies Prisma.purchase_ordersInclude;

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly items: PurchaseOrderItemsService,
  ) {}

  private async assertSupplierUsable(
    supplierId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const supplier = await db.suppliers.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true, status: true },
    });
    if (!supplier) throw new NotFoundException('Không tìm thấy nhà cung cấp');
    if (supplier.status !== SupplierStatus.active) {
      throw new BadRequestException(`Nhà cung cấp "${supplier.name}" đang ngừng hoạt động`);
    }
  }

  async create(dto: CreatePurchaseOrderDto) {
    await this.assertSupplierUsable(dto.supplierId);
    await this.items.validateProducts(dto.items.map((i) => i.productId));

    const rows = dto.items.map((i) => this.items.buildRow(i));

    return this.prisma.purchase_orders.create({
      data: {
        supplierId: dto.supplierId,
        expectedDate: new Date(dto.expectedDate),
        notes: dto.notes,
        totalAmount: this.items.sumSubtotal(rows),
        purchase_order_items: { create: rows },
      },
      include: DETAIL_INCLUDE,
    });
  }

  async findAll(query: QueryPurchaseOrderDto) {
    const { page, limit, status, supplierId, search, fromDate, toDate, sortOrder } = query;

    const where: Prisma.purchase_ordersWhereInput = {
      ...(status && { status }),
      ...(supplierId && { supplierId }),
      ...((fromDate || toDate) && {
        createdAt: {
          ...(fromDate && { gte: new Date(fromDate) }),
          ...(toDate && { lte: new Date(toDate) }),
        },
      }),
      ...(search && {
        OR: [
          { orderCode: { contains: search, mode: 'insensitive' } },
          { suppliers: { name: { contains: search, mode: 'insensitive' } } },
          { suppliers: { code: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.purchase_orders.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { createdAt: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchase_orders.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.purchase_orders.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn nhập hàng');
    return order;
  }

  async update(id: string, dto: UpdatePurchaseOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchase_orders.findUnique({
        where: { id },
        select: { id: true, status: true, orderCode: true },
      });
      if (!order) throw new NotFoundException('Không tìm thấy đơn nhập hàng');
      if (order.status !== PurchaseOrderStatus.pending) {
        throw new BadRequestException(
          `Đơn ${order.orderCode} đang ở trạng thái "${order.status}", không thể chỉnh sửa`,
        );
      }

      if (dto.supplierId) await this.assertSupplierUsable(dto.supplierId, tx);

      const data: Prisma.purchase_ordersUncheckedUpdateInput = {
        ...(dto.supplierId && { supplierId: dto.supplierId }),
        ...(dto.expectedDate && { expectedDate: new Date(dto.expectedDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      };

      if (dto.items) {
        await this.items.validateProducts(
          dto.items.map((i) => i.productId),
          tx,
        );
        const rows = dto.items.map((i) => this.items.buildRow(i));
        data.totalAmount = this.items.sumSubtotal(rows);
        data.purchase_order_items = { deleteMany: {}, create: rows };
      }

      return tx.purchase_orders.update({
        where: { id },
        data,
        include: DETAIL_INCLUDE,
      });
    });
  }

  async updateStatus(id: string, dto: UpdatePurchaseOrderStatusDto) {
    const order = await this.prisma.purchase_orders.findUnique({
      where: { id },
      select: { id: true, status: true, orderCode: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn nhập hàng');
    if (order.status !== PurchaseOrderStatus.pending) {
      throw new BadRequestException(
        `Đơn ${order.orderCode} đã ở trạng thái "${order.status}", không thể chuyển sang "${dto.status}"`,
      );
    }

    // TODO: khi status = received, tạo batches + cộng tồn kho (cần ngày sản xuất / hạn dùng từ client)
    return this.prisma.purchase_orders.update({
      where: { id },
      data: { status: dto.status },
      include: DETAIL_INCLUDE,
    });
  }

  async remove(id: string) {
    const order = await this.prisma.purchase_orders.findUnique({
      where: { id },
      select: { id: true, status: true, orderCode: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn nhập hàng');
    if (order.status === PurchaseOrderStatus.received) {
      throw new BadRequestException(
        `Đơn ${order.orderCode} đã nhập kho, không thể xoá`,
      );
    }

    // purchase_order_items có onDelete: Cascade nên tự xoá theo
    await this.prisma.purchase_orders.delete({ where: { id } });
    return { id, orderCode: order.orderCode, deleted: true };
  }
}
