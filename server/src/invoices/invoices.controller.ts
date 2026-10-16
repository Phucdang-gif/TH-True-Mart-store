import {
  Body,
  Controller,
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
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceActionDto } from './dto/invoice-action.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager', 'cashier')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Post()
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get()
  findAll(@Query() query: QueryInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  /** Chỉ sửa ghi chú. Hóa đơn là chứng từ nên không có API xoá: dùng cancel / return. */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.service.updateNotes(id, dto, user);
  }

  @Post(':id/return')
  @HttpCode(200)
  @Roles('manager')
  returnInvoice(@Param('id') id: string, @Body() dto: InvoiceActionDto, @CurrentUser() user: AuthUser) {
    return this.service.returnInvoice(id, dto, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles('manager')
  cancelInvoice(@Param('id') id: string, @Body() dto: InvoiceActionDto, @CurrentUser() user: AuthUser) {
    return this.service.cancelInvoice(id, dto, user);
  }
}
