import { Module } from '@nestjs/common';
import { StockAuditsController } from './stock_audits.controller';
import { StockAuditsService } from './stock_audits.service';

@Module({
  controllers: [StockAuditsController],
  providers: [StockAuditsService],
  exports: [StockAuditsService],
})
export class StockAuditsModule {}
