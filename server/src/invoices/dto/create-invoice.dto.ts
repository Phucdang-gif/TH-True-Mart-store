import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

// Một dòng khách chọn: chỉ gửi sản phẩm + số lượng.
// Giá bán, lô (FIFO) và khuyến mãi do SERVER quyết định, không tin dữ liệu từ giao diện.
export class InvoiceLineDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt({ message: "Số lượng phải là số nguyên" })
  @Min(1, { message: "Số lượng phải lớn hơn 0" })
  quantity: number;
}

export class PreviewInvoiceDto {
  @IsArray()
  @ArrayMinSize(1, { message: "Hóa đơn phải có ít nhất 1 sản phẩm" })
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  items: InvoiceLineDto[];

  // Mã giảm giá thu ngân nhập tay (khuyến mãi requiresCode)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  voucherCode?: string;
}

// amount (đồng, số nguyên):
//  - cash: SỐ TIỀN KHÁCH ĐƯA (server tự tính tiền thừa)
//  - transfer / card: số tiền thực nhận qua hình thức đó
export class InvoicePaymentDto {
  @IsIn(["cash", "transfer", "card"], {
    message: "Hình thức thanh toán không hợp lệ",
  })
  method: "cash" | "transfer" | "card";

  @IsInt({ message: "Số tiền phải là số nguyên (đồng)" })
  @Min(1, { message: "Số tiền thanh toán phải lớn hơn 0" })
  amount: number;

  // Bắt buộc với transfer (mã giao dịch) và card (mã chuẩn chi)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

export class CreateInvoiceDto extends PreviewInvoiceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoicePaymentDto)
  payments: InvoicePaymentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
