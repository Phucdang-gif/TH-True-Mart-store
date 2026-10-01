import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu đồng bộ cơ sở dữ liệu từ file SQL...');

  try {
    // Chạy file init.sql và chỉ định schema
    console.log('Đang thực thi init.sql...');
    execSync('npx prisma db execute --file prisma/init.sql --schema prisma/schema.prisma', { stdio: 'inherit' });

    // Chạy file data.sql và chỉ định schema
    console.log('Đang thực thi data.sql...');
    execSync('npx prisma db execute --file prisma/data.sql --schema prisma/schema.prisma', { stdio: 'inherit' });

    console.log('Đồng bộ dữ liệu thành công!');
  } catch (error) {
    console.error('Lỗi khi chạy script SQL:', error);
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });