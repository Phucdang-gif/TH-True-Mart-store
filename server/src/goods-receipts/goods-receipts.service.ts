import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoodsReceiptsService {
  constructor(private prisma: PrismaService) {}

  // Lấy danh sách toàn bộ phiếu nhập kho
  async findAll() {
    return this.prisma.goods_receipts.findMany({
      include: {
        suppliers: { select: { name: true, code: true } }, // Lấy tên nhà cung cấp
        staff: { select: { name: true, code: true } },     // Lấy tên người nhập kho
        purchase_orders: { select: { orderCode: true } }   // Kèm mã đơn đặt hàng (nếu có)
      },
      orderBy: { receivedAt: 'desc' }, // Mới nhất lên đầu
    });
  }

  // Lấy chi tiết một phiếu nhập kho
  async findOne(id: string) {
    const receipt = await this.prisma.goods_receipts.findUnique({
      where: { id },
      include: {
        suppliers: true,
        staff: { select: { name: true, code: true } },
        purchase_orders: true,
        // Lấy chi tiết các mặt hàng trong phiếu nhập
        goods_receipt_items: {
          include: {
            batches: {
              include: {
                // Lấy thông tin sản phẩm của lô hàng đó
                products: { select: { code: true, name: true, unit: true } }
              }
            }
          }
        }
      }
    });

    if (!receipt) {
      throw new NotFoundException('Không tìm thấy phiếu nhập kho này');
    }

    return receipt;
  }
}