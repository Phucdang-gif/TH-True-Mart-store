import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  // Tạo danh mục mới
  async create(createCategoryDto: CreateCategoryDto) {
    // Lưu ý: Nếu mã (code) hoặc tên (name) bị trùng, Prisma sẽ tự bắn ra lỗi Unique Constraint
    return this.prisma.category.create({
      data: createCategoryDto,
    });
  }

  // Lấy danh sách toàn bộ danh mục (dùng cho dropdown ở frontend)
  async findAll() {
    return this.prisma.category.findMany({
      orderBy: { createdAt: 'desc' }, // Sắp xếp mới nhất lên đầu
    });
  }

  // Lấy chi tiết 1 danh mục
  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    
    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục này');
    }
    
    return category;
  }

  // Cập nhật danh mục (Đổi tên, mã hoặc trạng thái)
  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    await this.findOne(id); // Kiểm tra xem có tồn tại không trước khi update

    return this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });
  }

  // Xóa danh mục
  async remove(id: string) {
    await this.findOne(id);

    // BẢO VỆ DỮ LIỆU: Kiểm tra xem có sản phẩm nào đang thuộc danh mục này không
    const productsCount = await this.prisma.products.count({
      where: { categoryId: id },
    });

    if (productsCount > 0) {
      throw new BadRequestException('Không thể xóa danh mục đang chứa sản phẩm. Vui lòng chuyển trạng thái thành "inactive" thay vì xóa.');
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }
}