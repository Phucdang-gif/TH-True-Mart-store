import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  // Lập đơn đặt hàng mới
  async create(staffId: string, dto: CreatePurchaseOrderDto) {
    // 1. Tự động tính tổng tiền tại Backend
    const totalAmount = dto.items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);

    // 2. Lưu đơn đặt hàng và chi tiết trong 1 lần (Nested Create)
    return this.prisma.purchase_orders.create({
      data: {
        orderCode: `PO-${Date.now()}`,
        supplierId: dto.supplierId,
        createdById: staffId,
        expectedDate: new Date(dto.expectedDate),
        totalAmount,
        notes: dto.notes,
        status: 'pending',
        // Tên relation này có thể là purchase_order_items tùy thuộc vào Prisma sinh ra
        purchase_order_items: {
          create: dto.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }))
        }
      },
      include: {
        suppliers: true,
        purchase_order_items: { include: { products: true } },
      }
    });
  }

  // Lấy danh sách đơn đặt hàng
  async findAll() {
    return this.prisma.purchase_orders.findMany({
      include: {
        suppliers: true,
        purchase_order_items: { include: { products: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Lấy chi tiết 1 đơn đặt hàng
  async findOne(id: string) {
    const order = await this.prisma.purchase_orders.findUnique({
      where: { id },
      include: {
        purchase_order_items: {
          include: { products: true }
        },
        suppliers: true,
        staff: true,
      }
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn đặt hàng');
    return order;
  }

  // Cập nhật đơn đặt hàng (thường dùng để Hủy đơn)
  async update(id: string, dto: UpdatePurchaseOrderDto) {
    // Không cho phép sửa nếu đơn đã nhận
    const order = await this.findOne(id);
    if (order.status === 'received') {
      throw new BadRequestException('Không thể sửa đơn hàng đã nhập kho');
    }

    return this.prisma.purchase_orders.update({
      where: { id },
      data: {
        notes: dto.notes,
        status: dto.status as any, // Ép kiểu an toàn cho Enum Prisma
      }
    });
  }

  // Xóa đơn đặt hàng
  async remove(id: string) {
    const order = await this.findOne(id);
    if (order.status === 'received') {
      throw new BadRequestException('Không thể xóa đơn hàng đã nhập kho');
    }
    return this.prisma.purchase_orders.delete({ where: { id } });
  }

  // Nhận hàng & Nhập kho (Giai đoạn 2)
  async receiveOrder(orderId: string, staffId: string, data: any) {
    const order = await this.findOne(orderId);
    if (order.status !== 'pending') {
      throw new BadRequestException('Đơn hàng không ở trạng thái chờ nhận');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Đổi trạng thái đơn đặt hàng
      await tx.purchase_orders.update({
        where: { id: orderId },
        data: { status: 'received' },
      });

      // 2. Tạo phiếu nhập kho
      const receipt = await tx.goods_receipts.create({
        data: {
          code: `GR-${Date.now()}`,
          supplierId: order.supplierId,
          purchaseOrderId: orderId,
          receivedById: staffId,
        },
      });

      // 3. Xử lý tạo lô và cộng tồn kho
      for (const item of data.items) {
        const batch = await tx.batches.create({
          data: {
            batchCode: item.batchCode,
            productId: item.productId,
            manufacturingDate: new Date(item.manufacturingDate),
            expiryDate: new Date(item.expiryDate),
            quantity: 0, 
          },
        });

        await tx.goods_receipt_items.create({
          data: {
            receiptId: receipt.id,
            batchId: batch.id,
            quantity: item.quantity,
            importPrice: item.importPrice,
          },
        });

        await tx.stock_movements.create({
          data: {
            batchId: batch.id,
            type: 'import',
            quantity: item.quantity,
            refType: 'receipt',
            refId: receipt.id,
            createdById: staffId,
          },
        });
      }

      return receipt;
    });
  }
}