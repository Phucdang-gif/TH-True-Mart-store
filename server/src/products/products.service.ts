import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto) {
    // Tìm kiếm theo code (đã bỏ phần OR dư thừa do không còn dùng barcode)
    const existingProduct = await this.prisma.products.findFirst({
      where: { code: createProductDto.code },
    });

    if (existingProduct) {
      // Trả về mã 409 thay vì throw Error (gây ra lỗi 500)
      throw new ConflictException('Sản phẩm với mã này đã tồn tại trong hệ thống');
    }

    let resolvedCategoryId = createProductDto.categoryId;
    if (!resolvedCategoryId && createProductDto.category) {
      resolvedCategoryId = createProductDto.category;
    }

    if (resolvedCategoryId) {
      const cat = await this.prisma.category.findFirst({
        where: {
          OR: [{ id: resolvedCategoryId }, { code: resolvedCategoryId }],
        },
      });
      if (cat) {
        resolvedCategoryId = cat.id;
      }
    }

    if (!resolvedCategoryId) {
      const firstCat = await this.prisma.category.findFirst();
      if (firstCat) resolvedCategoryId = firstCat.id;
    }

    const { category, categoryId, ...restData } = createProductDto;

    return this.prisma.products.create({
      data: {
        ...restData,
        categoryId: resolvedCategoryId as string,
      },
      include: {
        product_categories: true,
      },
    });
  }

  async findAll() {
    return this.prisma.products.findMany({
      where: { status: 'active' },
      include: {
        product_categories: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.products.findUnique({
      where: { id },
      include: {
        product_categories: true,
      },
    });

    // Quăng lỗi 404 nếu không tìm thấy, tránh việc trả về null với HTTP 200
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${id}`);
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto, staffId: string) {
    // Nếu ID không tồn tại, findOne sẽ ném lỗi 404 chặn lại ngay tại đây.
    const current = await this.findOne(id);

    const newPrice = (updateProductDto as { sellingPrice?: number }).sellingPrice;
    const priceChanged =
      newPrice !== undefined && Number(current.sellingPrice) !== Number(newPrice);

    let cleanData = { ...updateProductDto };
    if ((cleanData as any).category && !(cleanData as any).categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: {
          OR: [
            { id: (cleanData as any).category },
            { code: (cleanData as any).category },
          ],
        },
      });
      if (cat) {
        cleanData.categoryId = cat.id;
      }
    }
    delete (cleanData as any).category;

    if (!priceChanged) {
      return this.prisma.products.update({
        where: { id },
        data: cleanData,
        include: { product_categories: true },
      });
    }

    // Đổi giá bán: cập nhật sản phẩm + ghi lịch sử giá trong cùng 1 transaction
    const [updated] = await this.prisma.$transaction([
      this.prisma.products.update({
        where: { id },
        data: cleanData,
        include: { product_categories: true },
      }),
      this.prisma.price_history.create({
        data: {
          productId: id,
          oldPrice: current.sellingPrice,
          newPrice: newPrice as number,
          changedById: staffId,
        },
      }),
    ]);
    return updated;
  }

  async findPriceHistory(id: string) {
    await this.findOne(id);
    return this.prisma.price_history.findMany({
      where: { productId: id },
      include: { staff: { select: { name: true, code: true } } },
      orderBy: { changedAt: 'desc' },
    });
  }

  async remove(id: string) {
    // Kiểm tra xem sản phẩm có tồn tại không trước khi "xóa mềm" (chuyển status)
    await this.findOne(id);

    return this.prisma.products.update({
      where: { id },
      data: { status: 'discontinued' },
    });
  }
}
