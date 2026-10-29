import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { existsSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Phục vụ file tĩnh (ảnh sản phẩm tĩnh: /uploads/products/...)
  const publicDir = existsSync(join(__dirname, '..', 'public'))
    ? join(__dirname, '..', 'public')
    : existsSync(join(process.cwd(), 'server', 'public'))
    ? join(process.cwd(), 'server', 'public')
    : join(process.cwd(), 'public');

  if (existsSync(publicDir)) {
    app.useStaticAssets(publicDir);
  }

  // Bật tính năng tự động Validate
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Tự động loại bỏ các trường rác không có trong DTO
    forbidNonWhitelisted: true, // Báo lỗi nếu Frontend gửi lên trường lạ
    transform: true, // Tự động ép kiểu (VD: chuỗi "123" thành số 123 nếu DTO yêu cầu Number)
  }));
  
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });
  await app.listen(process.env.PORT || 3001);
}
bootstrap();
