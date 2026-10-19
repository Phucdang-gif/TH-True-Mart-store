import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';

@Injectable()
export class GoodsReceiptsService {
  constructor(private prisma: PrismaService) {}

  async create(staffId: string, dto: CreateGoodsReceiptDto) {
    // Sử dụng Transaction để đảm bảo tính toàn vẹn dữ liệu
    return await this.prisma.$transaction(async (tx) => {
      // 1. Tạo Phiếu nhập kho, Chi tiết phiếu nhập và Lô hàng (Batches) cùng lúc
      const receipt = await tx.goods_receipts.create({
        data: {
          code: `GR${Date.now()}`, // Tự động sinh mã phiếu nhập duy nhất
          receivedById: staffId,
          supplierId: dto.supplierId,
          purchaseOrderId: dto.purchaseOrderId,
          notes: dto.notes,
          
          goods_receipt_items: {
            create: dto.items.map((item) => ({
              quantity: item.quantity,
              importPrice: item.unitPrice, 
              
              // Tự động sinh lô hàng mới
              batches: {
                create: {
                  productId: item.productId,
                  batchCode: item.batchCode,
                  quantity: item.quantity, // Tồn kho ban đầu bằng số lượng nhập
                  // Schema bắt buộc có manufacturingDate, nếu không truyền sẽ lấy ngày hôm nay
                  manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate) : new Date(),
                  expiryDate: new Date(item.expiryDate),
                }
              }
            })),
          },
        },
      });

      // 2. Cập nhật trạng thái đơn đặt hàng (PO) nếu có
      if (dto.purchaseOrderId) {
        await tx.purchase_orders.update({
          where: { id: dto.purchaseOrderId },
          // Trong enum PurchaseOrderStatus của bạn, trạng thái hoàn tất nhập kho là 'received'
          data: { status: 'received' }, 
        });
      }

      return receipt;
    });
  }

  async findAll() {
    return this.prisma.goods_receipts.findMany({
      orderBy: { receivedAt: 'desc' }, // Schema dùng receivedAt
      include: {
        suppliers: { select: { name: true } },
        staff: { select: { name: true } },
        goods_receipt_items: {
          include: { 
            batches: {
              include: {
                products: { select: { name: true, unit: true } }
              }
            } 
          },
        },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.goods_receipts.findUnique({
      where: { id },
      include: {
        suppliers: true,
        goods_receipt_items: {
          include: {
            batches: {
              include: {
                products: true,
              }
            }
          }
        },
      },
    });
  }
}