// Nhân viên thao tác tạm thời, dùng chung cho các controller chưa có đăng nhập.
// PHẢI là id (uuid) có thật trong bảng staff, nếu không sẽ lỗi khóa ngoại.
// Khi làm module Auth: xóa file này và lấy staffId từ người dùng đăng nhập.
export const MOCK_STAFF_ID = '2a5500e6-dd82-4289-bf16-acf91c5d98c6';
