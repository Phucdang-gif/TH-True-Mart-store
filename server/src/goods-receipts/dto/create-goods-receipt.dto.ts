import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGoodsReceiptItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;

  @IsString()
  @IsNotEmpty()
  batchCode: string; // Mã lô do nhà cung cấp in trên vỏ hộp hoặc cửa hàng tự sinh

  @IsDateString()
  @IsOptional()
  manufacturingDate?: string; // Ngày sản xuất

  @IsDateString()
  @IsNotEmpty()
  expiryDate: string; // Hạn sử dụng (Rất quan trọng cho TH True Mart)
}

export class CreateGoodsReceiptDto {
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @IsString()
  @IsOptional()
  purchaseOrderId?: string; // Có thể nhập kho từ một PO hoặc nhập trực tiếp không qua PO

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptItemDto)
  items: CreateGoodsReceiptItemDto[];
}