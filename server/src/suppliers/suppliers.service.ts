import {Injectable, ConflictException, NotFoundException} from '@nestjs/common';
import {CreateSupplierDto} from './dto/create-supplier.dto';
import {UpdateSupplierDto} from './dto/update-supplier.dto';
import {PrismaService} from '../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}
  async create(createSupplierDto: CreateSupplierDto) {
    const existingSupplier = await this.prisma.suppliers.findFirst({
      where: {code: createSupplierDto.code},
    });

    if (existingSupplier) {
      throw new ConflictException('Mã nhà cung cấp đã tồn tại');
    }

    return this.prisma.suppliers.create({
      data: createSupplierDto,
    });
  }
  async findAll() {
    return this.prisma.suppliers.findMany({
      where: {status: 'active'},
    });
  }
  async findOne(id: string) {
    const supplier = await this.prisma.suppliers.findUnique({
      where: {id},
    });
    if (!supplier) {
      throw new NotFoundException('Nhà cung cấp không tồn tại');
    }
    return supplier;
  }
  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    await this.findOne(id);
    return this.prisma.suppliers.update({
      where: {id},
      data: updateSupplierDto,
    });
  }
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.suppliers.update({
      where: {id},
      data: {status: 'inactive'},
    });
  }
}