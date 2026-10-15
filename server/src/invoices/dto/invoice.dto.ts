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

export class CartLineDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(9999)
  quantity: number;
}

/** Dùng cho POST /invoices/preview: tính thử tiền + khuyến mãi, không ghi DB */
export class PreviewInvoiceDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Giỏ hàng trống' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CartLineDto)
  items: CartLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  voucherCode?: string;
}

export class PaymentInputDto {
  @IsIn(['cash', 'transfer', 'card'])
  method: 'cash' | 'transfer' | 'card';

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

export class CreateInvoiceDto extends PreviewInvoiceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PaymentInputDto)
  payments: PaymentInputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Duyệt đổi trả / hủy hóa đơn (chỉ quản lý) */
export class ApproveInvoiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @IsIn(['cash', 'transfer', 'card'])
  refundMethod: 'cash' | 'transfer' | 'card';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  refundRef?: string;
}

export class QueryInvoiceDto {
  @IsOptional()
  @IsIn(['completed', 'pending_payment', 'returned', 'cancelled', 'pending_approval'])
  status?: 'completed' | 'pending_payment' | 'returned' | 'cancelled' | 'pending_approval';

  /** Tìm theo mã hóa đơn */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 200;
}
