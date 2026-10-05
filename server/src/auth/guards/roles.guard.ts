import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    
    // Nếu API không yêu cầu role nào cụ thể -> cho phép qua
    if (!requiredRoles) {
      return true;
    }
    
    // Lấy thông tin user (đã được JwtStrategy giải mã và gắn vào request)
    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      return false;
    }

    // Kiểm tra xem role của user có nằm trong danh sách yêu cầu không
    return requiredRoles.includes(user.role);
  }
}