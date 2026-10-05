-- data.sql
-- Dữ liệu mẫu cho TH True Mart. Chạy SAU init.sql:
--   psql -U postgres -d th_true_mart -f data.sql
-- File có thể chạy lại nhiều lần: bản ghi trùng mã sẽ được bỏ qua (ON CONFLICT DO NOTHING).
-- =============================================================================
-- NHÂN VIÊN (mật khẩu đã băm bcrypt, KHÔNG lưu mật khẩu thô trong database)
-- Mật khẩu đăng nhập thử của cả 3 tài khoản: TH@12345   (chỉ dùng khi phát triển, hãy đổi khi triển khai thật)
-- staff.roleId được trigger trg_staff_sync_role_id tự gán theo cột "role".
-- =============================================================================
INSERT INTO "staff" (
    "code",
    "name",
    "phone",
    "username",
    "password",
    "role",
    "status",
    "shift",
    "mustChangePassword"
  )
VALUES (
    'NV001',
    'Nguyễn Văn Quản',
    '0901000001',
    'manager',
    '$2b$10$6/eqx48mUqEQko0M8YEENuWpUYncOnmXF5b2j0w/KadKbtd3kS.be',
    'manager',
    'active',
    'HANH_CHINH',
    false
  ),
  (
    'NV002',
    'Trần Thị Thu',
    '0901000002',
    'cashier',
    '$2b$10$6/eqx48mUqEQko0M8YEENuWpUYncOnmXF5b2j0w/KadKbtd3kS.be',
    'cashier',
    'active',
    'SANG',
    false
  ),
  (
    'NV003',
    'Lê Văn Kho',
    '0901000003',
    'warehouse',
    '$2b$10$6/eqx48mUqEQko0M8YEENuWpUYncOnmXF5b2j0w/KadKbtd3kS.be',
    'warehouse',
    'active',
    'CHIEU',
    false
  ) ON CONFLICT DO NOTHING;
-- =============================================================================
-- SẢN PHẨM
-- "discountPercent" bỏ trống (NULL = không giảm giá riêng).
-- =============================================================================
INSERT INTO "products" (
    "code",
    "name",
    "category",
    "unit",
    "sellingPrice",
    "costPrice",
    "minStockLevel",
    "description",
    "imageUrl"
  )
VALUES (
    'TH-MILK-DAU-180ML',
    'Sữa tươi tiệt trùng TH true MILK Dâu 180ml',
    'SUA_TUOI_TIET_TRUNG',
    'Lốc 4 hộp',
    38000,
    30000,
    20,
    'Sữa tươi tiệt trùng hương dâu hoàn toàn từ thiên nhiên',
    '/uploads/products/TH-MILK-DAU-180ML.webp'
  ),
  (
    'TH-FRESH-1L',
    'Sữa tươi thanh trùng TH true MILK Ít đường 1L',
    'SUA_TUOI_THANH_TRUNG',
    'Hộp',
    45000,
    36000,
    10,
    'Sữa tươi thanh trùng giữ trọn vị ngon, bảo quản lạnh',
    '/uploads/products/TH-FRESH-1L.webp'
  ),
  (
    'TH-YOGURT-ALOE',
    'Sữa chua ăn TH true YOGURT Nha đam',
    'SUA_CHUA',
    'Lốc 4 hộp',
    28000,
    22000,
    30,
    'Sữa chua lên men tự nhiên kết hợp nha đam giòn',
    '/uploads/products/TH-YOGURT-ALOE.webp'
  ),
  (
    'TH-JUICE-ORANGE',
    'Nước cam tự nhiên TH true JUICE 350ml',
    'NUOC',
    'Chai',
    20000,
    15000,
    50,
    'Nước trái cây ép lạnh, không thêm đường',
    '/uploads/products/TH-JUICE-ORANGE.webp'
  ),
  (
    'TH-ICECREAM-SOCOLA',
    'Kem que TH true ICE CREAM SOCOLA 52g',
    'KEM',
    'Que',
    25000,
    18000,
    15,
    'Kem que vị socola béo ngậy, mát lạnh',
    '/uploads/products/TH-ICECREAM-SOCOLA.webp'
  ) ON CONFLICT ("code") DO NOTHING;