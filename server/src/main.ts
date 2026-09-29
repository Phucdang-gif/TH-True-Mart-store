import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Bật tính năng tự động Validate
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Tự động loại bỏ các trường rác không có trong DTO
    forbidNonWhitelisted: true, // Báo lỗi nếu Frontend gửi lên trường lạ
    transform: true, // Tự động ép kiểu (VD: chuỗi "123" thành số 123 nếu DTO yêu cầu Number)
  }));
  
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  })
  await app.listen(process.env.PORT || 3001);
}
bootstrap();
