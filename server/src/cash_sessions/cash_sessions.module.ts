import { Module } from '@nestjs/common';
import { CashSessionsController } from './cash_sessions.controller';
import { CashSessionsService } from './cash_sessions.service';

@Module({
  controllers: [CashSessionsController],
  providers: [CashSessionsService],
  exports: [CashSessionsService],
})
export class CashSessionsModule {}
