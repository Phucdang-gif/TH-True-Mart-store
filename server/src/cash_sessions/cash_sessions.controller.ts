import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CashSessionsService } from './cash_sessions.service';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
import { QueryCashSessionDto } from './dto/query-cash-session.dto';

@Controller('cash-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager', 'cashier')
export class CashSessionsController {
  constructor(private readonly service: CashSessionsService) {}

  @Post('open')
  open(@Body() dto: OpenCashSessionDto, @CurrentUser() user: AuthUser) {
    return this.service.open(user, dto);
  }

  // Các route tĩnh phải đặt TRƯỚC ':id'
  @Get('current')
  current(@CurrentUser() user: AuthUser) {
    return this.service.findCurrent(user);
  }

  @Get()
  findAll(@Query() query: QueryCashSessionDto, @CurrentUser() user: AuthUser) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Post(':id/close')
  @HttpCode(200)
  close(@Param('id') id: string, @Body() dto: CloseCashSessionDto, @CurrentUser() user: AuthUser) {
    return this.service.close(id, dto, user);
  }

  @Post(':id/review')
  @HttpCode(200)
  @Roles('manager')
  review(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.review(id, user);
  }
}
