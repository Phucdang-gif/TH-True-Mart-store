import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { QueryPromotionDto } from './dto/query-promotion.dto';
import { UpdatePromotionStatusDto } from './dto/update-promotion-status.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { ValidateCodeDto } from './dto/validate-code.dto';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PromotionsController {
  constructor(private readonly service: PromotionsService) {}

  @Post()
  @Roles('manager')
  create(@Body() dto: CreatePromotionDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }

  @Get()
  @Roles('manager', 'cashier')
  findAll(@Query() query: QueryPromotionDto) {
    return this.service.findAll(query);
  }

  // Các route tĩnh phải đặt TRƯỚC ':id'
  @Post('refresh-status')
  @HttpCode(200)
  @Roles('manager')
  refreshStatus() {
    return this.service.syncStatuses();
  }

  @Get('validate-code')
  @Roles('manager', 'cashier')
  validateCode(@Query() query: ValidateCodeDto) {
    return this.service.validateCode(query.code, query.orderValue);
  }

  @Get(':id')
  @Roles('manager', 'cashier')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('manager')
  update(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('manager')
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePromotionStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
