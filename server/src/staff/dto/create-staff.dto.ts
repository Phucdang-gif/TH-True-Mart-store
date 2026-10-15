import { IsString, IsNotEmpty, IsEnum, IsOptional, IsPhoneNumber, MinLength } from 'class-validator';
import { StaffRole, Shift, StaffStatus } from '@prisma/client';
export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  // Có thể dùng @IsPhoneNumber('VN') nếu cần validate kỹ
  phone: string; 

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6) // Có thể thêm rule độ dài mật khẩu
  password: string;

  @IsEnum(StaffRole)
  @IsNotEmpty()
  role: StaffRole;

  @IsEnum(Shift)
  @IsNotEmpty()
  shift: Shift;

  @IsEnum(StaffStatus)
  @IsOptional()
  status?: StaffStatus;
}