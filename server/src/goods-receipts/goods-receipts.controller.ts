import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { GoodsReceiptsService } from './goods-receipts.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';

@Controller('api/goods-receipts')
export class GoodsReceiptsController {
  constructor(private readonly goodsReceiptsService: GoodsReceiptsService) {}

  @Post()
  create(@Body() createGoodsReceiptDto: CreateGoodsReceiptDto) {
    // TODO: Thay thế bằng ID từ JWT Token sau khi làm module Auth
    const mockStaffId = '2a5500e6-dd82-4289-bf16-acf91c5d98c6'; 
    return this.goodsReceiptsService.create(mockStaffId, createGoodsReceiptDto);
  }

  @Get()
  findAll() {
    return this.goodsReceiptsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.goodsReceiptsService.findOne(id);
  }
}