-- =============================================================================
-- DỮ LIỆU THỬ cho chức năng bán hàng (TÙY CHỌN - chỉ dùng để test, KHÔNG phải data chính thức)
-- Chạy sau init.sql + data.sql:
--   npx prisma db execute --file prisma/seed-sales-test.sql --schema prisma/schema.prisma
-- Có thể chạy lại nhiều lần (ON CONFLICT DO NOTHING).
-- Ngày tính theo thời điểm chạy để lô/khuyến mãi luôn còn hiệu lực khi test.
-- =============================================================================

-- Lô hàng: mỗi sản phẩm 2 lô (1 lô sắp hết hạn để test FEFO / near_expiry), riêng nước cam có thêm 1 lô ĐÃ HẾT HẠN
INSERT INTO "batches" ("batchCode", "productId", "manufacturingDate", "expiryDate", "quantity", "importPrice", "status")
SELECT v.code, p.id, now() - v.mfg::interval, now() + v.exp::interval, v.qty, p."costPrice", v.st::"BatchStatus"
FROM (VALUES
  ('TEST-DAU-A',   'TH-MILK-DAU-180ML',  '60 days', '20 days',  5, 'expiring_soon'),
  ('TEST-DAU-B',   'TH-MILK-DAU-180ML',  '10 days', '150 days', 30, 'good'),
  ('TEST-FRESH-A', 'TH-FRESH-1L',        '3 days',  '5 days',   4, 'expiring_soon'),
  ('TEST-FRESH-B', 'TH-FRESH-1L',        '1 days',  '9 days',   20, 'expiring_soon'),
  ('TEST-YOG-A',   'TH-YOGURT-ALOE',     '5 days',  '40 days',  25, 'good'),
  ('TEST-YOG-B',   'TH-YOGURT-ALOE',     '2 days',  '60 days',  25, 'good'),
  ('TEST-ICE-A',   'TH-ICECREAM-SOCOLA', '30 days', '300 days', 40, 'good'),
  ('TEST-JUICE-A', 'TH-JUICE-ORANGE',    '10 days', '90 days',  15, 'good'),
  ('TEST-JUICE-X', 'TH-JUICE-ORANGE',    '200 days','-2 days',  50, 'expired')
) AS v(code, pcode, mfg, exp, qty, st)
JOIN "products" p ON p."code" = v.pcode
ON CONFLICT ("batchCode") DO NOTHING;

-- Khuyến mãi mẫu
--   THSUMMER10 : tự động, giảm 10% nhóm sữa chua, đơn từ 100.000đ
--   THVIP20K   : cần nhập mã, giảm 20.000đ cho đơn từ 200.000đ
--   THFRESH15  : cần nhập mã, giảm 15% tối đa 30.000đ, giới hạn 3 lượt (test hết lượt dùng)
--   THOLD      : đã tạm dừng (test mã không còn hoạt động)
INSERT INTO "promotions" ("code","name","scope","discountType","value","maxDiscountAmount","startDate","endDate","minOrderValue","applicableCategory","requiresCode","usageLimit","status")
VALUES
  ('THSUMMER10','Giảm 10% sữa chua','category','percentage',10,NULL, now() - interval '1 day', now() + interval '30 days', 100000,'SUA_CHUA',false,NULL,'active'),
  ('THVIP20K','Đơn từ 200k giảm 20.000đ','order','fixed_amount',20000,NULL, now() - interval '1 day', now() + interval '30 days', 200000,NULL,true,NULL,'active'),
  ('THFRESH15','Giảm 15% tối đa 30k','order','percentage',15,30000, now() - interval '1 day', now() + interval '30 days', 0,NULL,true,3,'active'),
  ('THOLD','Chương trình đã tạm dừng','order','fixed_amount',10000,NULL, now() - interval '10 days', now() + interval '30 days', 0,NULL,true,NULL,'paused')
ON CONFLICT ("code") DO NOTHING;
