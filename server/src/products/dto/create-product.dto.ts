import{
    IsString, 
  IsNotEmpty, 
  IsNumber, 
  IsOptional, 
  IsInt, 
  IsEnum, 
  IsUrl, 
  Min

}from 'class-validator';
import {Category , ProductStatus} from '@prisma/client';

export class CreateProductDto {
    @IsString()
  @IsNotEmpty({ message: 'Mã sản phẩm (code) không được để trống' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên sản phẩm (name) không được để trống' })
  name: string;

  @IsEnum(Category, { message: 'Danh mục (category) không hợp lệ' })
  @IsNotEmpty({ message: 'Danh mục (category) không được để trống' })
  category: Category;

  @IsString()
  @IsNotEmpty({ message: 'Đơn vị tính (unit) không được để trống' })
  unit: string;

  @IsNumber()
  @IsNotEmpty({ message: 'Giá bán (sellingPrice) không được để trống' })
  @Min(0, { message: 'Giá bán phải lớn hơn hoặc bằng 0' })
  sellingPrice: number;

  @IsNumber()
  @IsNotEmpty({ message: 'Giá vốn (costPrice) không được để trống' })
  @Min(0, { message: 'Giá vốn phải lớn hơn hoặc bằng 0' })
  costPrice: number;

}
