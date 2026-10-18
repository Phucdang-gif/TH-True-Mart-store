import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { StockAuditsService } from './stock-audits.service';
import { CreateStockAuditDto } from './dto/create-stock-audit.dto';
import { UpdateAuditStatusDto } from './dto/update-audit-status.dto';

@Controller('stock-audits')
export class StockAuditsController {
  // Hardcode ID cho thủ kho và quản lý (thay thế bằng Auth Guard sau này)
  private readonly MOCK_WAREHOUSE_STAFF_ID = '003';
  private readonly MOCK_MANAGER_ID = '001';

  constructor(private readonly stockAuditsService: StockAuditsService) {}

  @Post()
  create(@Body() createStockAuditDto: CreateStockAuditDto) {
    return this.stockAuditsService.create(this.MOCK_WAREHOUSE_STAFF_ID, createStockAuditDto);
  }

  @Get()
  findAll() {
    return this.stockAuditsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockAuditsService.findOne(id);
  }

  // Quản lý duyệt phiếu: PATCH /stock-audits/{id}/status
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateAuditStatusDto: UpdateAuditStatusDto
  ) {
    return this.stockAuditsService.updateStatus(this.MOCK_MANAGER_ID, id, updateAuditStatusDto);
  }
}