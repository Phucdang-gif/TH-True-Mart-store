import {
  IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min,
} from 'class-validator';
import { DiscountType, PromotionScope } from '@prisma/client';

export class CreatePromotionDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã khuyến mãi không được để trống' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên chương trình không được để trống' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PromotionScope, { message: 'Phạm vi áp dụng không hợp lệ' })
  scope: PromotionScope;

  @IsEnum(DiscountType, { message: 'Loại giảm giá không hợp lệ' })
  discountType: DiscountType;

  @IsNumber()
  @Min(0.01, { message: 'Giá trị giảm phải lớn hơn 0' })
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  // Mã nhóm hàng (vd SUA_CHUA), bắt buộc khi scope = category
  @IsOptional()
  @IsString()
  categoryCode?: string;

  // Bắt buộc khi scope = near_expiry
  @IsOptional()
  @IsInt()
  @Min(1)
  nearExpiryDays?: number;

  // Bắt buộc khi scope = product
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsBoolean()
  requiresCode?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày bắt đầu phải dạng YYYY-MM-DD' })
  startDate: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày kết thúc phải dạng YYYY-MM-DD' })
  endDate: string;

  // true: kích hoạt ngay; false/bỏ trống: lưu nháp
  @IsOptional()
  @IsBoolean()
  activateNow?: boolean;
}