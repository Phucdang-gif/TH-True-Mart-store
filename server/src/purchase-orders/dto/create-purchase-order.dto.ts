import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsInt, Min, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class PurchaseOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreatePurchaseOrderDto {
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @IsString()
  @IsNotEmpty()
  expectedDate: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}