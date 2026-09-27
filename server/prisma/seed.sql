-- =============================================================================
-- TH TRUE MART - DỮ LIỆU MẪU (SEED)
-- Chạy SAU KHI đã tạo xong bảng bằng init.sql
--
-- Cách chạy:
--   psql -U postgres -d th_true_mart -f seed.sql
-- =============================================================================

-- Tài khoản: username = admin / password = 123456  (ĐỔI MẬT KHẨU KHI DÙNG THẬT)
INSERT INTO "staff" ("code", "name", "phone", "email", "username", "password", "role", "status", "shift")
VALUES (
  'NV001', 'Quản trị hệ thống', '0900000000', 'admin@thtruemart.vn',
  'admin', '$2b$10$oPFwd7sTSRddL692kIoiKej9Ivq6F5JyM9D4YMA2WZjKhXGa88kvO',
  'admin', 'active', 'HANH_CHINH'
);
