import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateBatchDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã lô không được để trống' })
  batchCode: string;

  @IsString()
  @IsNotEmpty({ message: 'ID sản phẩm không được để trống' })
  productId: string;

  @IsDateString({}, { message: 'Ngày sản xuất phải là định dạng ngày hợp lệ (ISO 8601)' })
  @IsNotEmpty()
  manufacturingDate: string;

  @IsDateString({}, { message: 'Ngày hết hạn phải là định dạng ngày hợp lệ' })
  @IsNotEmpty()
  expiryDate: string;
}