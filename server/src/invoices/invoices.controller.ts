import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  ApproveInvoiceDto,
  CreateInvoiceDto,
  PreviewInvoiceDto,
  QueryInvoiceDto,
} from './dto/invoice.dto';
import { InvoicesService } from './invoices.service';

type AuthedRequest = { user: { id: string; username: string; role: string } };

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /** Tính thử tiền + khuyến mãi cho giỏ hàng (không ghi DB) */
  @Post('preview')
  @Roles('manager', 'cashier')
  preview(@Body() dto: PreviewInvoiceDto) {
    return this.invoicesService.preview(dto);
  }

  /** Lập hóa đơn + thanh toán + trừ kho (thu ngân = người đang đăng nhập) */
  @Post()
  @Roles('manager', 'cashier')
  create(@Body() dto: CreateInvoiceDto, @Req() req: AuthedRequest) {
    return this.invoicesService.create(dto, req.user.id);
  }

  @Get()
  @Roles('manager', 'cashier')
  findAll(@Query() query: QueryInvoiceDto) {
    return this.invoicesService.findAll(query);
  }

  @Get(':id')
  @Roles('manager', 'cashier')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  /** Đổi trả hàng - chỉ quản lý */
  @Post(':id/return')
  @Roles('manager')
  returnInvoice(@Param('id') id: string, @Body() dto: ApproveInvoiceDto, @Req() req: AuthedRequest) {
    return this.invoicesService.approve(id, 'return', dto, req.user);
  }

  /** Hủy hóa đơn - chỉ quản lý */
  @Post(':id/cancel')
  @Roles('manager')
  cancelInvoice(@Param('id') id: string, @Body() dto: ApproveInvoiceDto, @Req() req: AuthedRequest) {
    return this.invoicesService.approve(id, 'cancel', dto, req.user);
  }
}
