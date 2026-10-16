import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Body chung cho đổi trả (return) và hủy (cancel) hóa đơn — chỉ quản lý */
export class InvoiceActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  /** Mặc định = tổng số tiền khách đã thanh toán (0 nếu chưa thanh toán) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  refundAmount?: number;

  /** Mặc định = hình thức thanh toán của hóa đơn; bắt buộc chọn nếu hóa đơn thanh toán nhiều hình thức */
  @IsOptional()
  @IsIn(['cash', 'transfer', 'card'])
  refundMethod?: 'cash' | 'transfer' | 'card';

  /** Mã giao dịch hoàn tiền, bắt buộc khi hoàn qua transfer / card */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  refundRef?: string;

  /** Có cộng hàng trả lại vào kho hay không (mặc định true; đặt false với hàng hỏng/hết hạn) */
  @IsOptional()
  @IsBoolean()
  restock?: boolean;
}
