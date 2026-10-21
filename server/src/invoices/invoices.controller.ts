import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, PreviewInvoiceDto } from './dto/create-invoice.dto';
import { MOCK_STAFF_ID } from '../common/mock-staff';

@Controller('api/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  // Tính giá + khuyến mãi cho giỏ hàng, KHÔNG ghi dữ liệu (POS gọi mỗi khi giỏ/mã thay đổi)
  @Post('preview')
  preview(@Body() dto: PreviewInvoiceDto) {
    return this.invoicesService.preview(dto);
  }

  // Chốt hóa đơn + thanh toán + trừ kho (1 transaction)
  @Post()
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(MOCK_STAFF_ID, dto);
  }

  @Get()
  findAll(@Query('status') status?: string) {
    return this.invoicesService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }
}
