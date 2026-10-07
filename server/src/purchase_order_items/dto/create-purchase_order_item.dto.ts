import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class CreatePurchaseOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity: number;

  /** Giá nhập trên 1 đơn vị (Decimal(12,2)) */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  unitPrice: number;
}