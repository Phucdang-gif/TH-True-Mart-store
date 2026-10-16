import { Category, DiscountType, PromotionScope } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePromotionDto {
  /** Mã chương trình / mã voucher (không phân biệt hoa thường khi nhập) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9._-]+$/, { message: 'code chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới' })
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(PromotionScope)
  scope?: PromotionScope;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  /** % (0-100) nếu percentage, số tiền nếu fixed_amount */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999_999.99)
  value: number;

  /** Trần giảm khi giảm theo % */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  maxDiscountAmount?: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  minOrderValue?: number;

  /** Bắt buộc khi scope = category */
  @IsOptional()
  @IsEnum(Category)
  applicableCategory?: Category;

  /** Bắt buộc khi scope = near_expiry: lô còn <= N ngày hạn dùng */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  nearExpiryDays?: number;

  /** true: thu ngân phải nhập mã; false: tự động áp dụng */
  @IsOptional()
  @IsBoolean()
  requiresCode?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  /** Mặc định `scheduled` (theo DB). `expired` do hệ thống/endpoint status quản lý */
  @IsOptional()
  @IsIn(['draft', 'scheduled', 'active', 'paused'])
  status?: 'draft' | 'scheduled' | 'active' | 'paused';

  /** Bắt buộc khi scope = product; tuỳ chọn giới hạn thêm cho near_expiry */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  productIds?: string[];
}
