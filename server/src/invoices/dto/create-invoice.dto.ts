import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class InvoiceItemInputDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  /** Không gửi: server tự chọn lô theo FEFO (hết hạn trước, xuất trước), có thể tách nhiều lô */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  batchId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity: number;
}

export class InvoicePaymentInputDto {
  @IsIn(['cash', 'transfer', 'card'])
  method: 'cash' | 'transfer' | 'card';

  /** Số tiền khách ĐƯA theo hình thức này (tiền mặt được đưa dư, server tự tính tiền thối) */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  amount: number;

  /** Bắt buộc với transfer / card: mã giao dịch / mã chuẩn chi */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

/**
 * Giá, giảm giá, tổng tiền KHÔNG nhận từ client: server tính lại từ DB để tránh gian lận.
 */
export class CreateInvoiceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemInputDto)
  items: InvoiceItemInputDto[];

  /** Mã voucher (promotion có requiresCode = true) */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  voucherCode?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => InvoicePaymentInputDto)
  payments: InvoicePaymentInputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
