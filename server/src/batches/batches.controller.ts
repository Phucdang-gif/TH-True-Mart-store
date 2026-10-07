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
} from '@nestjs/common';
import { BatchesService } from './batches.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { QueryBatchDto } from './dto/query-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';

@Controller('batches')
export class BatchesController {
  constructor(private readonly service: BatchesService) {}

  @Post()
  create(@Body() dto: CreateBatchDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryBatchDto) {
    return this.service.findAll(query);
  }

  // Các route tĩnh phải đặt TRƯỚC ':id'
  @Post('refresh-status')
  @HttpCode(200)
  refreshStatus() {
    return this.service.syncStatuses();
  }

  @Get('product/:productId/available')
  findAvailableByProduct(@Param('productId') productId: string) {
    return this.service.findAvailableByProduct(productId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBatchDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}