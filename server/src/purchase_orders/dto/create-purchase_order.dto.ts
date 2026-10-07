import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreatePurchaseOrderItemDto } from '../../purchase_order_items/dto/create-purchase_order_item.dto';

/**
 * orderCode do DB tự sinh (next_code), totalAmount và subtotal do server tính,
 * status mặc định `pending` => client không gửi các field này.
 */
export class CreatePurchaseOrderDto {
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @IsDateString()
  expectedDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Đơn nhập hàng phải có ít nhất 1 sản phẩm' })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}