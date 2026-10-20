import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { ChangePromotionStatusDto } from './dto/change-promotion-status.dto';
import { MOCK_STAFF_ID } from '../common/mock-staff';

@Controller('api/promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  findAll() {
    return this.promotionsService.findAll();
  }

  @Post()
  create(@Body() dto: CreatePromotionDto) {
    return this.promotionsService.create(MOCK_STAFF_ID, dto);
  }

  @Patch(':id/status')
  changeStatus(@Param('id') id: string, @Body() dto: ChangePromotionStatusDto) {
    return this.promotionsService.changeStatus(id, dto);
  }
}