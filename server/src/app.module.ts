import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { BatchesModule } from './batches/batches.module';
import { CategoriesModule } from './categories/categories.module';
import { StockMovementsModule } from './stock-movements/stock-movements.module';
import { GoodsReceiptsModule } from './goods-receipts/goods-receipts.module';
import { StockAuditsModule } from './stock-audits/stock-audits.module';
import { PromotionsModule } from './promotions/promotions.module';
import { InvoicesModule } from './invoices/invoices.module';

@Module({
  imports: [PrismaModule, ProductsModule, SuppliersModule, PurchaseOrdersModule, BatchesModule, CategoriesModule, StockMovementsModule, GoodsReceiptsModule, StockAuditsModule, PromotionsModule, InvoicesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
