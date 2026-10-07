import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Chỉ cho sửa số lượng / đơn giá. Muốn đổi sản phẩm thì xoá dòng rồi thêm dòng mới. */
export class UpdatePurchaseOrderItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  unitPrice?: number;
}