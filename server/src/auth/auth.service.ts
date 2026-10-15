import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service'; // Chú ý sửa lại đường dẫn nếu file prisma.service.ts của bạn nằm chỗ khác
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    // 1. Tìm nhân viên theo username (Sửa 'staff' thành tên model thực tế trong schema.prisma của bạn)
    const user = await this.prisma.staff.findUnique({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');
    }

    // 2. So sánh mật khẩu bằng bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');
    }

    // 3. Tách mật khẩu ra, KHÔNG trả về frontend
    const { password: _, ...userWithoutPassword } = user;

    // 4. Tạo JWT Token
    const payload = { sub: user.id, username: user.username, role: user.role };

    return {
      user: userWithoutPassword,
      access_token: await this.jwtService.signAsync(payload),
      mustChangePassword: user.mustChangePassword,
    };
  }
}