import { Module } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase_orders.service';
import { PurchaseOrdersController } from './purchase_orders.controller';

@Module({
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
