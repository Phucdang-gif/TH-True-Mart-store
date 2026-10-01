import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { SupplierStatus } from '@prisma/client'; 

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã nhà cung cấp không được để trống' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên nhà cung cấp không được để trống' })
  name: string;

  @IsString()
  @IsNotEmpty()
  contactPerson: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  categoryProvided: string;

  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus; 
}