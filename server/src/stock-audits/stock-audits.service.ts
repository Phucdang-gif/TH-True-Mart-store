import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockAuditDto } from './dto/create-stock-audit.dto';
import { UpdateAuditStatusDto } from './dto/update-audit-status.dto';

@Injectable()
export class StockAuditsService {
  constructor(private prisma: PrismaService) {}

  // 1. THỦ KHO LẬP PHIẾU KIỂM KÊ
  async create(staffId: string, dto: CreateStockAuditDto) {
    // Lấy thông tin các lô hàng đang được kiểm kê để biết tồn kho hệ thống hiện tại
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Phiếu kiểm kê phải có ít nhất 1 dòng.');
    }
    const batchIds = dto.items.map(item => item.batchId);
    if (new Set(batchIds).size !== batchIds.length) {
      throw new BadRequestException('Một lô hàng xuất hiện nhiều lần trong phiếu.');
    }
    const batches = await this.prisma.batches.findMany({
      where: { id: { in: batchIds } }
    });

    if (batches.length !== dto.items.length) {
      throw new BadRequestException('Một hoặc nhiều lô hàng không tồn tại.');
    }

    // Chuẩn bị dữ liệu cho các dòng chi tiết kiểm kê
    const auditItemsData = dto.items.map(item => {
      const batch = batches.find(b => b.id === item.batchId);
      if (!batch) {
        throw new BadRequestException(`Không tìm thấy dữ liệu cho lô hàng có ID: ${item.batchId}`);
      }
      const diff = item.actualQuantity - batch.quantity;
      // Logic DB: Nếu lệch thì bắt buộc phải ghi lý do giải trình
      if (diff !== 0 && (!item.reason || item.reason.trim() === '')) {
        throw new BadRequestException(`Lô hàng ${batch.batchCode} có chênh lệch ${diff}. Bắt buộc phải nhập lý do.`);
      }

      return {
        batchId: item.batchId,
        systemQuantity: batch.quantity,
        actualQuantity: item.actualQuantity,
        reason: item.reason,
        // Cột difference DB tự tính toán nên ta không truyền vào
      };
    });

    // Lưu phiếu kiểm kê (Mặc định trạng thái là pending_approval)
    return this.prisma.stock_audits.create({
      data: {
        auditCode: dto.auditCode,
        performedById: staffId,
        status: 'pending_approval',
        stock_audit_items: {
          create: auditItemsData
        }
      },
      include: { stock_audit_items: true }
    });
  }

  // 2. XEM DANH SÁCH PHIẾU
  async findAll() {
    return this.prisma.stock_audits.findMany({
      include: {
        // Kèm chi tiết để giao diện hiển thị lịch sử (số mặt hàng, chênh lệch)
        stock_audit_items: {
          include: {
            batches: { include: { products: { select: { name: true, code: true, unit: true } } } }
          }
        },
        staff_stock_audits_performedByIdTostaff: { select: { name: true, code: true } }, // Tên người lập
        staff_stock_audits_approvedByIdTostaff: { select: { name: true, code: true } }  // Tên người duyệt
      },
      orderBy: { auditDate: 'desc' }
    });
  }

  // 3. XEM CHI TIẾT 1 PHIẾU
  async findOne(id: string) {
    const audit = await this.prisma.stock_audits.findUnique({
      where: { id },
      include: {
        stock_audit_items: {
          include: {
            batches: { include: { products: { select: { name: true, code: true, unit: true } } } }
          }
        },
        staff_stock_audits_performedByIdTostaff: { select: { name: true } },
        staff_stock_audits_approvedByIdTostaff: { select: { name: true } }
      }
    });

    if (!audit) throw new NotFoundException('Không tìm thấy phiếu kiểm kê');
    return audit;
  }

  // 4. QUẢN LÝ DUYỆT / TỪ CHỐI PHIẾU
  async updateStatus(id: string, managerId: string, dto: UpdateAuditStatusDto) {
    const audit = await this.findOne(id);

    if (audit.status !== 'pending_approval' && audit.status !== 'draft') {
      throw new BadRequestException(`Không thể thay đổi trạng thái phiếu đang là ${audit.status}`);
    }

    // NẾU TỪ CHỐI: Chỉ cần đổi trạng thái, không làm gì thêm
    if (dto.status === 'rejected') {
      return this.prisma.stock_audits.update({
        where: { id },
        data: { status: 'rejected', approvedById: managerId }
      });
    }

    // NẾU DUYỆT: Dùng Transaction để vừa đổi trạng thái, vừa ghi Sổ kho cho các mặt hàng bị lệch
    return this.prisma.$transaction(async (tx) => {
      // 1. Đổi trạng thái phiếu
      const updatedAudit = await tx.stock_audits.update({
        where: { id },
        data: { status: 'approved', approvedById: managerId }
      });

      // 2. Lọc ra các dòng có chênh lệch tồn kho
      const itemsWithDiff = audit.stock_audit_items.filter(
        item => item.actualQuantity !== item.systemQuantity
      );

      // 3. Sinh ra các dòng ghi chú Sổ kho (stock_movements)
      if (itemsWithDiff.length > 0) {
        const movementsData = itemsWithDiff.map(item => ({
          batchId: item.batchId,
          type: 'audit' as const,
          quantity: item.actualQuantity - item.systemQuantity, // Chênh lệch (âm hoặc dương)
          reason: `Điều chỉnh theo phiếu kiểm kê ${audit.auditCode}. Lý do: ${item.reason?.trim() || 'Không rõ'}`,
          refType: 'audit',
          refId: audit.id,
          createdById: managerId
        }));

        // Insert nhiều dòng vào sổ kho cùng lúc. Trigger DB sẽ tự cộng/trừ vào lô hàng.
        await tx.stock_movements.createMany({
          data: movementsData
        });
      }

      return updatedAudit;
    });
  }
}