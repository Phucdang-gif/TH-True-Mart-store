import { Module } from '@nestjs/common';
import { StockAuditsService } from './stock-audits.service';
import { StockAuditsController } from './stock-audits.controller';
@Module({
  controllers: [StockAuditsController],
  providers: [StockAuditsService],
})
export class StockAuditsModule {}