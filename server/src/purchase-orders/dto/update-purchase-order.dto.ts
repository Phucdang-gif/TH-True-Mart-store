import { PartialType } from '@nestjs/mapped-types';
import { CreatePurchaseOrderDto } from './create-purchase-order.dto';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {
  @IsString()
  @IsOptional()
  @IsIn(['pending', 'received', 'cancelled'])
  status?: 'pending' | 'received' | 'cancelled';
}