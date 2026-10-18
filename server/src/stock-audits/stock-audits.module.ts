import { Module } from '@nestjs/common';
import { StockAuditsService } from './stock-audits.service';
import { StockAuditsController } from './stock-audits.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StockAuditsController],
  providers: [StockAuditsService],
})
export class StockAuditsModule {}