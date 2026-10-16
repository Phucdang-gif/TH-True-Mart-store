import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QueryLoginLogDto } from './dto/query-login-log.dto';
import { LoginLogsService } from './login_logs.service';

@Controller('login-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class LoginLogsController {
  constructor(private readonly service: LoginLogsService) {}

  @Get()
  findAll(@Query() query: QueryLoginLogDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
