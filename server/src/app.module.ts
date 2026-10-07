import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { AuthModule } from './auth/auth.module';
import { StaffModule } from './staff/staff.module';
import { PurchaseOrdersModule } from './purchase_orders/purchase_orders.module';
import { PurchaseOrderItemsModule } from './purchase_order_items/purchase_order_items.module';
import { BatchesModule } from './batches/batches.module';

@Module({
  imports: [PrismaModule, ProductsModule, SuppliersModule, AuthModule, StaffModule, PurchaseOrdersModule, PurchaseOrderItemsModule, BatchesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
