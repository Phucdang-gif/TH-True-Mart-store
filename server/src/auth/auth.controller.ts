import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // --- API VÍ DỤ ĐỂ TEST GUARD ---
  // Gọi API này bắt buộc phải có token
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user; // Trả về thông tin user đã giải mã từ token
  }

  // Gọi API này bắt buộc phải có token VÀ role là ADMIN
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN') 
  @Get('admin-only')
  getAdminData() {
    return { message: 'Đây là dữ liệu mật chỉ dành cho admin' };
  }
}