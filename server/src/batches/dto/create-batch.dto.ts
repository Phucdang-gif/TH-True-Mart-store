import { Type } from 'class-transformer';
import {
  IsDateString,
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

/**
 * `status` không nhận từ client: server tự tính từ expiryDate.
 * `batchCode` không có default ở DB nên nếu client không gửi, server sẽ tự sinh.
 */
export class CreateBatchDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'batchCode chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới',
  })
  batchCode?: string;

  @IsDateString()
  manufacturingDate: string;

  @IsDateString()
  expiryDate: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  quantity: number;

  /** Giá nhập trên 1 đơn vị (Decimal(12,2)) */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  importPrice: number;

  /** Nhân viên nhận hàng. Nếu đã có auth, nên lấy từ user đăng nhập thay vì client gửi. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  receivedById?: string;
}