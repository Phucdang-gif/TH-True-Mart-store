import { Controller, Get, Param } from '@nestjs/common';
import { GoodsReceiptsService } from './goods-receipts.service';

@Controller('goods-receipts')
export class GoodsReceiptsController {
  constructor(private readonly goodsReceiptsService: GoodsReceiptsService) {}

  @Get()
  findAll() {
    return this.goodsReceiptsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.goodsReceiptsService.findOne(id);
  }
}