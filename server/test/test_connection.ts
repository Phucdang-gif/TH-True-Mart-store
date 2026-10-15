import { PrismaClient } from '@prisma/client';

// Khởi tạo Prisma Client
const prisma = new PrismaClient();

async function main() {
  console.log('Đang thử kết nối đến Database...');

  try {
    // Thử truy vấn bảng roles (bảng này đã được insert sẵn dữ liệu từ init.sql)
    const roles = await prisma.roles.findMany();
    
    console.log('KẾT NỐI THÀNH CÔNG!');
    console.log('Dữ liệu bảng Roles lấy từ Database:');
    console.table(roles);

    // Bạn có thể test thử lấy danh sách nhân viên
    // const staff = await prisma.staff.findMany();
    // console.table(staff);

  } catch (error) {
    console.error('KẾT NỐI THẤT BẠI. Lỗi chi tiết:');
    console.error(error);
  } finally {
    // Luôn nhớ đóng kết nối sau khi hoàn thành
    await prisma.$disconnect();
  }
}

main();