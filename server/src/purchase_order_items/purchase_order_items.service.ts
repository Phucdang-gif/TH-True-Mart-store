import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderItemDto } from '../purchase_order_items/dto/create-purchase_order_item.dto';
import { UpdatePurchaseOrderItemDto } from '../purchase_order_items/dto/update-purchase_order_item.dto';

export const ITEM_INCLUDE = {
  products: { select: { id: true, code: true, name: true, unit: true } },
} satisfies Prisma.purchase_order_itemsInclude;

@Injectable()
export class PurchaseOrderItemsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── Helpers dùng chung (PurchaseOrdersService cũng gọi) ─────────────────────────

  /** Kiểm tra danh sách sản phẩm: không trùng, tồn tại, đang active. */
  async validateProducts(
    productIds: string[],
    db: Prisma.TransactionClient = this.prisma,
  ) {
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('Danh sách sản phẩm bị trùng lặp');
    }

    const products = await db.products.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, status: true },
    });

    const found = new Set(products.map((p) => p.id));
    const missing = productIds.filter((id) => !found.has(id));
    if (missing.length) {
      throw new NotFoundException(`Không tìm thấy sản phẩm: ${missing.join(', ')}`);
    }

    const inactive = products.filter((p) => p.status !== ProductStatus.active);
    if (inactive.length) {
      throw new BadRequestException(
        `Sản phẩm đã ngừng kinh doanh: ${inactive.map((p) => p.name).join(', ')}`,
      );
    }
  }

  /** Tính subtotal = quantity * unitPrice bằng Decimal để không lệch số lẻ. */
  buildRow(dto: { productId: string; quantity: number; unitPrice: number }) {
    const unitPrice = new Prisma.Decimal(dto.unitPrice);
    return {
      productId: dto.productId,
      quantity: dto.quantity,
      unitPrice,
      subtotal: unitPrice.mul(dto.quantity),
    };
  }

  sumSubtotal(rows: { subtotal: Prisma.Decimal }[]) {
    return rows.reduce((sum, r) => sum.add(r.subtotal), new Prisma.Decimal(0));
  }

  /** Tính lại totalAmount của đơn từ các dòng hiện có. */
  async recalcTotal(tx: Prisma.TransactionClient, purchaseOrderId: string) {
    const { _sum } = await tx.purchase_order_items.aggregate({
      where: { purchaseOrderId },
      _sum: { subtotal: true },
    });
    await tx.purchase_orders.update({
      where: { id: purchaseOrderId },
      data: { totalAmount: _sum.subtotal ?? new Prisma.Decimal(0) },
    });
  }

  /** Chỉ cho sửa dòng khi đơn còn ở trạng thái pending. */
  private async assertOrderEditable(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.purchase_orders.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, orderCode: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn nhập hàng');
    if (order.status !== PurchaseOrderStatus.pending) {
      throw new BadRequestException(
        `Đơn ${order.orderCode} đang ở trạng thái "${order.status}", không thể chỉnh sửa`,
      );
    }
  }

  // ───────────────────────── CRUD ─────────────────────────

  async findAll(orderId: string) {
    const order = await this.prisma.purchase_orders.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn nhập hàng');

    return this.prisma.purchase_order_items.findMany({
      where: { purchaseOrderId: orderId },
      include: ITEM_INCLUDE,
      orderBy: { products: { name: 'asc' } },
    });
  }

  async findOne(orderId: string, itemId: string) {
    const item = await this.prisma.purchase_order_items.findFirst({
      where: { id: itemId, purchaseOrderId: orderId },
      include: ITEM_INCLUDE,
    });
    if (!item) throw new NotFoundException('Không tìm thấy dòng hàng trong đơn');
    return item;
  }

  async create(orderId: string, dto: CreatePurchaseOrderItemDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertOrderEditable(tx, orderId);
      await this.validateProducts([dto.productId], tx);

      const existed = await tx.purchase_order_items.findFirst({
        where: { purchaseOrderId: orderId, productId: dto.productId },
        select: { id: true },
      });
      if (existed) {
        throw new ConflictException(
          'Sản phẩm đã có trong đơn, hãy cập nhật số lượng thay vì thêm mới',
        );
      }

      const item = await tx.purchase_order_items.create({
        data: { purchaseOrderId: orderId, ...this.buildRow(dto) },
        include: ITEM_INCLUDE,
      });
      await this.recalcTotal(tx, orderId);
      return item;
    });
  }

  async update(orderId: string, itemId: string, dto: UpdatePurchaseOrderItemDto) {
    if (dto.quantity === undefined && dto.unitPrice === undefined) {
      throw new BadRequestException('Cần truyền quantity hoặc unitPrice để cập nhật');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertOrderEditable(tx, orderId);

      const current = await tx.purchase_order_items.findFirst({
        where: { id: itemId, purchaseOrderId: orderId },
      });
      if (!current) throw new NotFoundException('Không tìm thấy dòng hàng trong đơn');

      const row = this.buildRow({
        productId: current.productId,
        quantity: dto.quantity ?? current.quantity,
        unitPrice: dto.unitPrice ?? current.unitPrice.toNumber(),
      });

      const item = await tx.purchase_order_items.update({
        where: { id: itemId },
        data: {
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          subtotal: row.subtotal,
        },
        include: ITEM_INCLUDE,
      });
      await this.recalcTotal(tx, orderId);
      return item;
    });
  }

  async remove(orderId: string, itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertOrderEditable(tx, orderId);

      const current = await tx.purchase_order_items.findFirst({
        where: { id: itemId, purchaseOrderId: orderId },
      });
      if (!current) throw new NotFoundException('Không tìm thấy dòng hàng trong đơn');

      const count = await tx.purchase_order_items.count({
        where: { purchaseOrderId: orderId },
      });
      if (count <= 1) {
        throw new BadRequestException(
          'Đơn phải có ít nhất 1 dòng hàng. Hãy huỷ đơn nếu không cần nữa',
        );
      }

      await tx.purchase_order_items.delete({ where: { id: itemId } });
      await this.recalcTotal(tx, orderId);
      return current;
    });
  }
}