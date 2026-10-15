import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'SECRET_KEY_CUA_BAN', 
    });
  }

  async validate(payload: any) {
    // Thông tin này sẽ được NestJS tự động gắn vào `req.user`
    return { id: payload.sub, username: payload.username, role: payload.role };
  }
}