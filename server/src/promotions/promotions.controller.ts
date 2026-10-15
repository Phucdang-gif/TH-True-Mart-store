import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
@UseGuards(JwtAuthGuard)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  /** Khuyến mãi đang chạy, còn lượt dùng (POS hiển thị chương trình đang áp dụng) */
  @Get('active')
  listActive() {
    return this.promotionsService.listForPos();
  }
}
