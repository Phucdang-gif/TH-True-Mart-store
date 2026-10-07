import { Module } from '@nestjs/common';
import { PurchaseOrderItemsService } from './purchase_order_items.service';
import { PurchaseOrderItemsController } from './purchase_order_items.controller';

@Module({
  controllers: [PurchaseOrderItemsController],
  providers: [PurchaseOrderItemsService],
  exports: [PurchaseOrderItemsService]
})
export class PurchaseOrderItemsModule {}
