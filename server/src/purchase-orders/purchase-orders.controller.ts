import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  // Hardcode tạm ID của một staff có sẵn trong database (lấy từ bảng staff)
  // Sau khi làm tính năng Đăng nhập, ID này sẽ được trích xuất từ JWT Token (@Req() req)
  private readonly MOCK_STAFF_ID = '001'; 

  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  create(@Body() createPurchaseOrderDto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(this.MOCK_STAFF_ID, createPurchaseOrderDto);
  }

  @Get()
  findAll() {
    return this.purchaseOrdersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
    return this.purchaseOrdersService.update(id, updatePurchaseOrderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.purchaseOrdersService.remove(id);
  }

  @Post(':id/receive')
  receiveOrder(@Param('id') id: string, @Body() receiveData: any) {
    return this.purchaseOrdersService.receiveOrder(id, this.MOCK_STAFF_ID, receiveData);
  }
}