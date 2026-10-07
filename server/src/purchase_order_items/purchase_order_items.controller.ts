import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreatePurchaseOrderItemDto } from '../purchase_order_items/dto/create-purchase_order_item.dto';
import { UpdatePurchaseOrderItemDto } from '../purchase_order_items/dto/update-purchase_order_item.dto';
import { PurchaseOrderItemsService } from '../purchase_order_items/purchase_order_items.service';

@Controller('purchase-orders/:orderId/items')
export class PurchaseOrderItemsController {
  constructor(private readonly service: PurchaseOrderItemsService) {}

  @Get()
  findAll(@Param('orderId') orderId: string) {
    return this.service.findAll(orderId);
  }

  @Get(':itemId')
  findOne(@Param('orderId') orderId: string, @Param('itemId') itemId: string) {
    return this.service.findOne(orderId, itemId);
  }

  @Post()
  create(
    @Param('orderId') orderId: string,
    @Body() dto: CreatePurchaseOrderItemDto,
  ) {
    return this.service.create(orderId, dto);
  }

  @Patch(':itemId')
  update(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePurchaseOrderItemDto,
  ) {
    return this.service.update(orderId, itemId, dto);
  }

  @Delete(':itemId')
  remove(@Param('orderId') orderId: string, @Param('itemId') itemId: string) {
    return this.service.remove(orderId, itemId);
  }
}