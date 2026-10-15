import { Injectable , OnModuleInit} from '@nestjs/common';
import {PrismaClient} from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {

  async onModuleInit() {
    // Tự động kết nối DB khi NestJS khởi động
    await this.$connect();
  }
  
}
