import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';

@Injectable()
export class BatchesService {
  constructor(private prisma: PrismaService) {}

  // Khởi tạo lô thủ công (Số lượng luôn = 0)
  async create(createBatchDto: CreateBatchDto) {
    const { manufacturingDate, expiryDate, ...rest } = createBatchDto;
    
    const mDate = new Date(manufacturingDate);
    const eDate = new Date(expiryDate);

    if (eDate <= mDate) {
      throw new BadRequestException('Ngày hết hạn phải lớn hơn ngày sản xuất');
    }

    return this.prisma.batches.create({
      data: {
        ...rest,
        manufacturingDate: mDate,
        expiryDate: eDate,
        quantity: 0, // Bắt buộc = 0 theo logic hệ thống
      },
    });
  }

  // Lấy danh sách tồn kho theo lô (Tự động join với bảng products để lấy tên, ảnh...)
  async findAll() {
    return this.prisma.batches.findMany({
      include: {
        products: {
          include: { product_categories: true } // Lấy luôn tên danh mục nếu cần
        }
      },
      orderBy: { expiryDate: 'asc' }, // Ưu tiên xếp lô sắp hết hạn lên đầu
    });
  }

  async findOne(id: string) {
    const batch = await this.prisma.batches.findUnique({
      where: { id },
      include: { products: true },
    });

    if (!batch) {
      throw new NotFoundException('Không tìm thấy lô hàng');
    }
    return batch;
  }

  async update(id: string, updateBatchDto: UpdateBatchDto) {
    await this.findOne(id); // Kiểm tra tồn tại

    const dataToUpdate: any = { ...updateBatchDto };

    // Xử lý chuyển đổi chuỗi ngày tháng sang object Date cho Prisma
    if (updateBatchDto.manufacturingDate) {
      dataToUpdate.manufacturingDate = new Date(updateBatchDto.manufacturingDate);
    }
    if (updateBatchDto.expiryDate) {
      dataToUpdate.expiryDate = new Date(updateBatchDto.expiryDate);
    }

    // Kiểm tra logic ngày nếu có update
    if (dataToUpdate.manufacturingDate && dataToUpdate.expiryDate) {
      if (dataToUpdate.expiryDate <= dataToUpdate.manufacturingDate) {
        throw new BadRequestException('Ngày hết hạn phải lớn hơn ngày sản xuất');
      }
    }

    return this.prisma.batches.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  async remove(id: string) {
    const batch = await this.findOne(id);

    // Không cho phép xóa lô nếu đang có tồn kho
    if (batch.quantity > 0) {
      throw new BadRequestException('Không thể xóa lô hàng đang có số lượng tồn kho > 0');
    }

    // Prisma cũng sẽ tự chặn thao tác xóa nếu lô này đã có lịch sử trong stock_movements
    try {
      return await this.prisma.batches.delete({
        where: { id },
      });
    } catch (error) {
      throw new BadRequestException('Không thể xóa lô hàng này vì đã phát sinh lịch sử giao dịch (sổ kho).');
    }
  }
}