import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { StockMovementsService } from './stock-movements.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@Controller('stock-movements')
export class StockMovementsController {
  // Hardcode ID nhân viên (sau này thay bằng Auth token)
  private readonly MOCK_STAFF_ID = '001'; 

  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Post()
  create(@Body() createStockMovementDto: CreateStockMovementDto) {
    return this.stockMovementsService.create(this.MOCK_STAFF_ID, createStockMovementDto);
  }

  // Lấy lịch sử thẻ kho (hỗ trợ lọc: GET /stock-movements?batchId=123)
  @Get()
  findAll(@Query('batchId') batchId?: string) {
    return this.stockMovementsService.findAll(batchId);
  }
}