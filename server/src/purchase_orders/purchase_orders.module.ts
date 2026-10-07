import { Module } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase_orders.service';
import { PurchaseOrdersController } from './purchase_orders.controller';
import { PurchaseOrderItemsModule } from '../purchase_order_items/purchase_order_items.module';

@Module({
  imports: [PurchaseOrderItemsModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
