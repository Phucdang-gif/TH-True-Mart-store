import { Module } from '@nestjs/common';
import { LoginLogsController } from './login_logs.controller';
import { LoginLogsService } from './login_logs.service';

@Module({
  controllers: [LoginLogsController],
  providers: [LoginLogsService],
  exports: [LoginLogsService],
})
export class LoginLogsModule {}
