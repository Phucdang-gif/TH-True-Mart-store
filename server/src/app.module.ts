import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { BatchesModule } from './batches/batches.module';
import { CategoriesModule } from './categories/categories.module';

@Module({
  imports: [PrismaModule, ProductsModule, SuppliersModule, PurchaseOrdersModule, BatchesModule, CategoriesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
