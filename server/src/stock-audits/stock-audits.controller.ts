import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { StockAuditsService } from './stock-audits.service';
import { CreateStockAuditDto } from './dto/create-stock-audit.dto';
import { UpdateAuditStatusDto } from './dto/update-audit-status.dto';

@Controller('api/stock-audits')
export class StockAuditsController {
  // Hardcode ID nhân viên (thay bằng Auth Guard sau này).
  // PHẢI là id (uuid) có thật trong bảng staff, nếu không sẽ lỗi khóa ngoại khi lưu phiếu.
  // Dùng chung id với purchase-orders.controller.ts.
  private readonly MOCK_WAREHOUSE_STAFF_ID = '2a5500e6-dd82-4289-bf16-acf91c5d98c6';
  private readonly MOCK_MANAGER_ID = '2a5500e6-dd82-4289-bf16-acf91c5d98c6';

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
    return this.stockAuditsService.updateStatus(id, this.MOCK_MANAGER_ID, updateAuditStatusDto);
  }
}