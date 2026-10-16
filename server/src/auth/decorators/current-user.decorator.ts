import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Dữ liệu user do JwtStrategy.validate() gắn vào request */
export interface AuthUser {
  id: string;
  username: string;
  role: 'manager' | 'cashier' | 'warehouse';
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
