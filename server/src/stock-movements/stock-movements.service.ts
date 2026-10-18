import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@Injectable()
export class StockMovementsService {
  constructor(private prisma: PrismaService) {}

  // Ghi nhận biến động kho thủ công (Xuất hủy, Điều chỉnh)
  async create(staffId: string, dto: CreateStockMovementDto) {
    // 1. Ràng buộc logic cơ sở dữ liệu
    if (dto.type === 'export' && dto.quantity > 0) {
      throw new BadRequestException('Xuất hủy kho (export) bắt buộc số lượng phải là số âm (vd: -5)');
    }

    // 2. Kiểm tra xem lô hàng có tồn tại không
    const batch = await this.prisma.batches.findUnique({
      where: { id: dto.batchId },
    });
    if (!batch) {
      throw new BadRequestException('Lô hàng không tồn tại');
    }

    // 3. Ghi vào sổ kho (Trigger ở Database sẽ tự động lấy quantity này cộng/trừ vào bảng batches)
    try {
      return await this.prisma.stock_movements.create({
        data: {
          batchId: dto.batchId,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          createdById: staffId,
          // refType và refId để null vì đây là thao tác thủ công, không theo chứng từ (phiếu nhập/hóa đơn)
        },
      });
    } catch (error: any) {
      // Bắt lỗi từ PostgreSQL Trigger nếu xuất quá số lượng tồn
      if (error.code === 'P2010' || error.message?.includes('không đủ tồn')) {
        throw new BadRequestException(`Lô hàng không đủ số lượng tồn kho để thực hiện thao tác này.`);
      }
      throw error;
    }
  }

  // Lấy toàn bộ lịch sử biến động (Thẻ kho) - có thể lọc theo batchId
  async findAll(batchId?: string) {
    const whereCondition = batchId ? { batchId } : {};

    return this.prisma.stock_movements.findMany({
      where: whereCondition,
      include: {
        staff: { select: { name: true, code: true } }, // Lấy tên người thực hiện
        batches: {
          include: { products: { select: { name: true, code: true, unit: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }, // Mới nhất lên đầu
    });
  }
}