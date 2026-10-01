import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {PrismaService} from '../prisma/prisma.service';
@Injectable()
export class ProductsService {

  constructor (private prisma: PrismaService){}

  async create(createProductDto: CreateProductDto) {
    const existingProduct = await this.prisma.products.findFirst({
      where:{
        OR:[
          {code: createProductDto.code}
        ]
      }
    });
    if (existingProduct) {
      throw new Error('Sản phẩm với mã hoặc mã vạch đã tồn tại');
    }
    return this.prisma.products.create({
      data: createProductDto
    });
  }

  async findAll() {
    return this.prisma.products.findMany({
      where :{status: 'active'},
      orderBy: {createdAt: 'desc'},

    });
  }

  async findOne(id: string) {
    return this.prisma.products.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    return this.prisma.products.update({
      where: { id },
      data: updateProductDto,
    });
  }

  async remove(id: string) {
    return this.prisma.products.update({
      where: { id },
      data: { status: 'discontinued' },
    });
  }
}
