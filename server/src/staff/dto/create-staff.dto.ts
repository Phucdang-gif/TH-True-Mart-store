import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã nhân viên không được để trống' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Họ tên nhân viên không được để trống' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  phone: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Vai trò nhân viên không được để trống' })
  roleId: string;
}
