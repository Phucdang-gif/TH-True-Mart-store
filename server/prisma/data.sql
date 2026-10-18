-- =============================================================================
-- data.sql - Dữ liệu mẫu để test TH True Mart. Chạy SAU init.sql, MỘT LẦN:
--   psql -U postgres -d th_true_mart -v ON_ERROR_STOP=1 -f data.sql
-- Muốn nạp lại: chạy reset_dev.sql -> init.sql -> data.sql.
--
-- Mật khẩu đăng nhập thử của mọi tài khoản: TH@12345 (chỉ dùng khi phát triển).
-- Tài khoản: manager | cashier | warehouse | cashier2 (phải đổi mật khẩu lần đầu)
--            locked (đã bị khóa - dùng test đăng nhập thất bại)
-- Mọi mốc thời gian tính TƯƠNG ĐỐI so với lúc chạy file, nên cảnh báo hết hạn luôn đúng.
-- Tồn kho (batches.quantity) được trigger tự tính từ stock_movements - KHÔNG insert trực tiếp.
-- File chỉ gồm câu lệnh SQL chuẩn nên chạy được cả bằng psql lẫn `prisma db execute`.
-- Kiểm tra sau khi nạp: chạy verify.sql bằng psql.
-- =============================================================================
BEGIN;
DO $$ BEGIN IF EXISTS (
  SELECT 1
  FROM "staff"
) THEN RAISE EXCEPTION 'Database đã có dữ liệu. Chạy reset_dev.sql và init.sql trước khi nạp lại data.sql';
END IF;
END $$;
-- =============================================================================
-- NHÂN VIÊN (mật khẩu băm bcrypt của TH@12345)
-- =============================================================================
INSERT INTO "staff" (
    "code",
    "name",
    "phone",
    "username",
    "password",
    "roleId",
    "status",
    "mustChangePassword",
    "failedLoginCount",
    "lockedUntil",
    "lastLoginAt"
  )
SELECT v.code,
  v.name,
  v.phone,
  v.username,
  '$2b$10$6/eqx48mUqEQko0M8YEENuWpUYncOnmXF5b2j0w/KadKbtd3kS.be',
  r."id",
  v.status::"StaffStatus",
  v.must_change,
  v.failed,
  v.locked_until,
  v.last_login
FROM (
    VALUES (
        'NV001',
        'Nguyễn Văn Quản',
        '0901000001',
        'manager',
        'manager',
        'active',
        false,
        0,
        NULL::timestamptz,
        NOW() - INTERVAL '1 hour'
      ),
      (
        'NV002',
        'Trần Thị Thu',
        '0901000002',
        'cashier',
        'cashier',
        'active',
        false,
        0,
        NULL,
        NOW() - INTERVAL '5 hours'
      ),
      (
        'NV003',
        'Lê Văn Kho',
        '0901000003',
        'warehouse',
        'warehouse',
        'active',
        false,
        0,
        NULL,
        NOW() - INTERVAL '1 day'
      ),
      (
        'NV004',
        'Phạm Minh Anh',
        '0901000004',
        'cashier2',
        'cashier',
        'active',
        true,
        0,
        NULL,
        NULL
      ),
      (
        'NV005',
        'Hoàng Văn Nghỉ',
        '0901000005',
        'locked',
        'cashier',
        'inactive',
        false,
        5,
        NOW() + INTERVAL '1 day',
        NOW() - INTERVAL '20 days'
      )
  ) AS v(
    code,
    name,
    phone,
    username,
    role_code,
    status,
    must_change,
    failed,
    locked_until,
    last_login
  )
  JOIN "roles" r ON r."code" = v.role_code;
-- =============================================================================
-- NHÓM SẢN PHẨM & SẢN PHẨM
-- =============================================================================
INSERT INTO "Category" ("code", "name")
VALUES ('SUA_TUOI_TIET_TRUNG', 'Sữa tươi tiệt trùng'),
  ('SUA_TUOI_THANH_TRUNG', 'Sữa tươi thanh trùng'),
  ('SUA_CHUA', 'Sữa chua'),
  ('BO_PHOMAI', 'Bơ và phô mai'),
  ('KEM', 'Kem'),
  ('NUOC', 'Nước trái cây'),
  ('TRA', 'Trà');
INSERT INTO "products" (
    "code",
    "name",
    "categoryId",
    "unit",
    "sellingPrice",
    "costPrice",
    "minStockLevel",
    "description",
    "imageUrl",
    "status"
  )
SELECT v.code,
  v.name,
  c."id",
  v.unit,
  v.sell,
  v.cost,
  v.min_stock,
  v.descr,
  '/uploads/products/' || v.code || '.webp',
  v.status::"ProductStatus"
FROM (
    VALUES (
        'TH-MILK-DAU-180ML',
        'Sữa tươi tiệt trùng TH true MILK Dâu 180ml',
        'SUA_TUOI_TIET_TRUNG',
        'Lốc 4 hộp',
        38000,
        30000,
        20,
        'Sữa tươi tiệt trùng hương dâu hoàn toàn từ thiên nhiên',
        'active'
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
        'active'
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
        'active'
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
        'active'
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
        'active'
      ),
      (
        'TH-BUTTER-200G',
        'Bơ lạt TH true BUTTER 200g',
        'BO_PHOMAI',
        'Hộp',
        65000,
        50000,
        10,
        'Bơ lạt nguyên chất, dùng làm bánh và nấu ăn',
        'active'
      ),
      (
        'TH-CHEESE-SLICE',
        'Phô mai lát TH true CHEESE 136g',
        'BO_PHOMAI',
        'Hộp',
        52000,
        40000,
        10,
        'Phô mai lát tiện dụng cho bữa sáng',
        'active'
      ),
      (
        'TH-TEA-CHANH',
        'Trà chanh TH true TEA 450ml',
        'TRA',
        'Chai',
        15000,
        11000,
        40,
        'Trà chanh giải khát, ít đường',
        'active'
      ),
      (
        'TH-MILK-SOCOLA-180ML',
        'Sữa tươi tiệt trùng TH true MILK Socola 180ml',
        'SUA_TUOI_TIET_TRUNG',
        'Lốc 4 hộp',
        38000,
        30000,
        60,
        'Sữa tươi tiệt trùng vị socola (ngưỡng tối thiểu 60 để test cảnh báo sắp hết hàng)',
        'active'
      ),
      (
        'TH-YOGURT-CAM-DRINK',
        'Sữa chua uống TH true YOGURT Cam 180ml',
        'SUA_CHUA',
        'Lốc 4 chai',
        30000,
        24000,
        0,
        'Sản phẩm đã ngừng kinh doanh (test ẩn khỏi tra cứu bán hàng)',
        'discontinued'
      )
  ) AS v(
    code,
    name,
    cat,
    unit,
    sell,
    cost,
    min_stock,
    descr,
    status
  )
  JOIN "Category" c ON c."code" = v.cat;
-- Lịch sử giá: mỗi sản phẩm có dòng đặt giá đầu; 3 sản phẩm có thêm lần tăng giá
INSERT INTO "price_history" (
    "productId",
    "oldPrice",
    "newPrice",
    "changedById",
    "changedAt"
  )
SELECT p."id",
  v.old_price,
  v.new_price,
  s."id",
  NOW() - make_interval(days => v.days_ago)
FROM (
    VALUES ('TH-MILK-DAU-180ML', NULL::numeric, 36000, 60),
      ('TH-MILK-DAU-180ML', 36000, 38000, 30),
      ('TH-FRESH-1L', NULL, 43000, 60),
      ('TH-FRESH-1L', 43000, 45000, 20),
      ('TH-YOGURT-ALOE', NULL, 28000, 60),
      ('TH-JUICE-ORANGE', NULL, 18000, 60),
      ('TH-JUICE-ORANGE', 18000, 20000, 15),
      ('TH-ICECREAM-SOCOLA', NULL, 25000, 60),
      ('TH-BUTTER-200G', NULL, 65000, 45),
      ('TH-CHEESE-SLICE', NULL, 52000, 45),
      ('TH-TEA-CHANH', NULL, 15000, 45),
      ('TH-MILK-SOCOLA-180ML', NULL, 38000, 45),
      ('TH-YOGURT-CAM-DRINK', NULL, 30000, 60)
  ) AS v(pcode, old_price, new_price, days_ago)
  JOIN "products" p ON p."code" = v.pcode
  JOIN "staff" s ON s."code" = 'NV001';
-- =============================================================================
-- NHÀ CUNG CẤP & ĐƠN ĐẶT HÀNG
-- =============================================================================
INSERT INTO "suppliers" (
    "code",
    "name",
    "contactPerson",
    "phone",
    "address",
    "categoryProvided",
    "status"
  )
VALUES (
    'NCC001',
    'Công ty CP Thực phẩm sữa TH',
    'Nguyễn Thị Lan',
    '02388888001',
    'Nghĩa Đàn, Nghệ An',
    'Sữa tươi, sữa chua, kem',
    'active'
  ),
  (
    'NCC002',
    'Công ty TNHH Nước giải khát Việt Tươi',
    'Trần Văn Bình',
    '02838888002',
    'KCN Tân Bình, TP. Hồ Chí Minh',
    'Nước trái cây, trà',
    'active'
  ),
  (
    'NCC003',
    'Công ty Bơ sữa Đà Lạt',
    'Lê Thị Hoa',
    '02633888003',
    'Đức Trọng, Lâm Đồng',
    'Bơ, phô mai',
    'inactive'
  );
INSERT INTO "purchase_orders" (
    "orderCode",
    "supplierId",
    "createdById",
    "createdAt",
    "expectedDate",
    "totalAmount",
    "status",
    "notes"
  )
SELECT v.code,
  sp."id",
  st."id",
  NOW() - make_interval(days => v.created_ago),
  NOW() + make_interval(days => v.expected_in),
  v.total,
  v.status::"PurchaseOrderStatus",
  v.notes
FROM (
    VALUES (
        'PO-2026-001',
        'NCC001',
        40,
        -36,
        5700000,
        'received',
        NULL::text
      ),
      (
        'PO-2026-002',
        'NCC002',
        10,
        -6,
        2900000,
        'received',
        NULL
      ),
      (
        'PO-2026-003',
        'NCC001',
        1,
        3,
        2700000,
        'pending',
        'Đơn đang chờ hàng về (test nhập kho theo đơn)'
      ),
      (
        'PO-2026-004',
        'NCC003',
        25,
        -20,
        1000000,
        'cancelled',
        'Nhà cung cấp ngừng hợp tác'
      )
  ) AS v(
    code,
    supplier,
    created_ago,
    expected_in,
    total,
    status,
    notes
  )
  JOIN "suppliers" sp ON sp."code" = v.supplier
  JOIN "staff" st ON st."code" = 'NV003';
INSERT INTO "purchase_order_items" (
    "purchaseOrderId",
    "productId",
    "quantity",
    "unitPrice"
  )
SELECT po."id",
  p."id",
  v.qty,
  v.price
FROM (
    VALUES ('PO-2026-001', 'TH-MILK-DAU-180ML', 100, 30000),
      ('PO-2026-001', 'TH-MILK-SOCOLA-180ML', 60, 30000),
      ('PO-2026-001', 'TH-ICECREAM-SOCOLA', 50, 18000),
      ('PO-2026-002', 'TH-JUICE-ORANGE', 120, 15000),
      ('PO-2026-002', 'TH-TEA-CHANH', 100, 11000),
      ('PO-2026-003', 'TH-BUTTER-200G', 30, 50000),
      ('PO-2026-003', 'TH-CHEESE-SLICE', 30, 40000),
      ('PO-2026-004', 'TH-BUTTER-200G', 20, 50000)
  ) AS v(po, pcode, qty, price)
  JOIN "purchase_orders" po ON po."orderCode" = v.po
  JOIN "products" p ON p."code" = v.pcode;
-- =============================================================================
-- KHO: LÔ HÀNG (quantity = 0, sẽ tăng khi ghi sổ nhập kho bên dưới)
--   L-CAM-0826   : ĐÃ HẾT HẠN 2 ngày
--   L-FRESH-1026 : còn 3 ngày (sắp hết hạn)
--   L-YOG-0926   : còn 9 ngày (sắp hết hạn)
-- =============================================================================
INSERT INTO "batches" (
    "batchCode",
    "productId",
    "manufacturingDate",
    "expiryDate"
  )
SELECT v.code,
  p."id",
  NOW() - make_interval(days => v.mfg_ago),
  NOW() + make_interval(days => v.exp_in)
FROM (
    VALUES ('L-CAM-0826', 'TH-JUICE-ORANGE', 60, -2),
      ('L-MD-0926', 'TH-MILK-DAU-180ML', 40, 140),
      ('L-MS-0926', 'TH-MILK-SOCOLA-180ML', 40, 140),
      ('L-KEM-0926', 'TH-ICECREAM-SOCOLA', 38, 330),
      ('L-YOG-0926', 'TH-YOGURT-ALOE', 50, 9),
      ('L-CAM-1026', 'TH-JUICE-ORANGE', 8, 45),
      ('L-TRA-1026', 'TH-TEA-CHANH', 8, 172),
      ('L-FRESH-1026', 'TH-FRESH-1L', 5, 3),
      ('L-YOG-1026', 'TH-YOGURT-ALOE', 5, 55)
  ) AS v(code, pcode, mfg_ago, exp_in)
  JOIN "products" p ON p."code" = v.pcode;
-- Phiếu nhập kho (GR-2026-002 và GR-2026-004 nhập theo đơn đặt hàng; các phiếu còn lại ngoài đơn)
INSERT INTO "goods_receipts" (
    "code",
    "supplierId",
    "purchaseOrderId",
    "receivedById",
    "receivedAt",
    "notes"
  )
SELECT v.code,
  sp."id",
  po."id",
  st."id",
  NOW() - make_interval(days => v.days_ago),
  v.notes
FROM (
    VALUES (
        'GR-2026-001',
        'NCC002',
        NULL::text,
        45,
        'Nhập lô nước cam đợt cũ'
      ),
      ('GR-2026-002', 'NCC001', 'PO-2026-001', 35, NULL),
      ('GR-2026-003', 'NCC001', NULL, 20, NULL),
      ('GR-2026-004', 'NCC002', 'PO-2026-002', 6, NULL),
      (
        'GR-2026-005',
        'NCC001',
        NULL,
        5,
        'Giao bổ sung ngoài đơn đặt hàng'
      )
  ) AS v(code, supplier, po_code, days_ago, notes)
  JOIN "suppliers" sp ON sp."code" = v.supplier
  JOIN "staff" st ON st."code" = 'NV003'
  LEFT JOIN "purchase_orders" po ON po."orderCode" = v.po_code;
INSERT INTO "goods_receipt_items" (
    "receiptId",
    "batchId",
    "quantity",
    "importPrice"
  )
SELECT gr."id",
  b."id",
  v.qty,
  v.price
FROM (
    VALUES ('GR-2026-001', 'L-CAM-0826', 30, 15000),
      ('GR-2026-002', 'L-MD-0926', 100, 30000),
      ('GR-2026-002', 'L-MS-0926', 60, 30000),
      ('GR-2026-002', 'L-KEM-0926', 50, 18000),
      ('GR-2026-003', 'L-YOG-0926', 40, 22000),
      ('GR-2026-004', 'L-CAM-1026', 120, 15000),
      ('GR-2026-004', 'L-TRA-1026', 100, 11000),
      ('GR-2026-005', 'L-FRESH-1026', 60, 36000),
      ('GR-2026-005', 'L-YOG-1026', 80, 22000)
  ) AS v(receipt, batch, qty, price)
  JOIN "goods_receipts" gr ON gr."code" = v.receipt
  JOIN "batches" b ON b."batchCode" = v.batch;
-- SỔ KHO 1: nhập kho theo từng dòng phiếu nhập (trigger tự cộng tồn vào lô)
INSERT INTO "stock_movements" (
    "batchId",
    "type",
    "quantity",
    "reason",
    "refType",
    "refId",
    "createdById",
    "createdAt"
  )
SELECT gri."batchId",
  'import',
  gri."quantity",
  'Nhập kho theo phiếu ' || gr."code",
  'receipt',
  gr."id",
  gr."receivedById",
  gr."receivedAt"
FROM "goods_receipt_items" gri
  JOIN "goods_receipts" gr ON gr."id" = gri."receiptId"
ORDER BY gr."receivedAt";
-- SỔ KHO 2: hủy một phần lô nước cam đã hết hạn (còn lại 20 để test cảnh báo hết hạn)
INSERT INTO "stock_movements" (
    "batchId",
    "type",
    "quantity",
    "reason",
    "createdById",
    "createdAt"
  )
SELECT b."id",
  'export',
  -10,
  'Hủy hàng hết hạn (một phần)',
  s."id",
  NOW() - INTERVAL '1 day'
FROM "batches" b
  JOIN "staff" s ON s."code" = 'NV003'
WHERE b."batchCode" = 'L-CAM-0826';
-- =============================================================================
-- KHUYẾN MÃI (đủ 5 trạng thái, 4 phạm vi)
-- =============================================================================
INSERT INTO "promotions" (
    "code",
    "name",
    "description",
    "scope",
    "discountType",
    "value",
    "maxDiscountAmount",
    "minOrderValue",
    "categoryId",
    "nearExpiryDays",
    "requiresCode",
    "usageLimit",
    "startDate",
    "endDate",
    "status",
    "statusChangedAt",
    "createdById"
  )
SELECT v.code,
  v.name,
  v.descr,
  v.scope::"PromotionScope",
  v.dtype::"DiscountType",
  v.val,
  v.max_discount,
  v.min_order,
  c."id",
  v.near_days,
  v.requires_code,
  v.usage_limit,
  NOW() + make_interval(days => v.start_in),
  NOW() + make_interval(days => v.end_in),
  v.status::"PromotionStatus",
  CASE
    WHEN v.status = 'draft' THEN NULL
    ELSE NOW() + make_interval(days => LEAST(v.start_in, 0))
  END,
  s."id"
FROM (
    VALUES (
        'KM-TUAN-LE',
        'Giảm 5% hóa đơn từ 100.000đ',
        'Tự động áp dụng cho hóa đơn đủ điều kiện, giảm tối đa 20.000đ',
        'order',
        'percentage',
        5,
        20000,
        100000,
        NULL::text,
        NULL::integer,
        false,
        NULL::integer,
        -30,
        30,
        'active'
      ),
      (
        'GIAM20K',
        'Mã giảm 20.000đ cho hóa đơn từ 150.000đ',
        'Thu ngân nhập mã, tối đa 100 lượt',
        'order',
        'fixed_amount',
        20000,
        NULL,
        150000,
        NULL,
        NULL,
        true,
        100,
        -30,
        60,
        'active'
      ),
      (
        'KM-SUACHUA',
        'Sữa chua giảm 10%',
        'Giảm 10% các sản phẩm thuộc nhóm Sữa chua',
        'category',
        'percentage',
        10,
        NULL,
        0,
        'SUA_CHUA',
        NULL,
        false,
        NULL,
        -10,
        20,
        'active'
      ),
      (
        'XA-HANG-HSD',
        'Xả hàng lô sắp hết hạn giảm 30%',
        'Áp dụng cho lô còn từ 10 ngày hạn dùng trở xuống',
        'near_expiry',
        'percentage',
        30,
        NULL,
        0,
        NULL,
        10,
        false,
        NULL,
        -5,
        60,
        'active'
      ),
      (
        'KM-KEM-HE',
        'Kem mùa hè giảm 15%',
        'Đang tạm dừng (test trạng thái paused)',
        'product',
        'percentage',
        15,
        NULL,
        0,
        NULL,
        NULL,
        false,
        NULL,
        -20,
        40,
        'paused'
      ),
      (
        'KM-SOCOLA-SAP-TOI',
        'Socola giảm 12%',
        'Chưa tới ngày bắt đầu (test trạng thái scheduled)',
        'product',
        'percentage',
        12,
        NULL,
        0,
        NULL,
        NULL,
        false,
        NULL,
        5,
        20,
        'scheduled'
      ),
      (
        'KM-TET',
        'Giảm 50.000đ hóa đơn từ 300.000đ',
        'Bản nháp chưa kích hoạt (test trạng thái draft)',
        'order',
        'fixed_amount',
        50000,
        NULL,
        300000,
        NULL,
        NULL,
        false,
        NULL,
        60,
        75,
        'draft'
      ),
      (
        'KM-KHAI-TRUONG',
        'Khai trương giảm 10%',
        'Đã kết thúc (test trạng thái expired)',
        'order',
        'percentage',
        10,
        30000,
        0,
        NULL,
        NULL,
        false,
        NULL,
        -90,
        -60,
        'expired'
      )
  ) AS v(
    code,
    name,
    descr,
    scope,
    dtype,
    val,
    max_discount,
    min_order,
    cat,
    near_days,
    requires_code,
    usage_limit,
    start_in,
    end_in,
    status
  )
  JOIN "staff" s ON s."code" = 'NV001'
  LEFT JOIN "Category" c ON c."code" = v.cat;
INSERT INTO "promotion_products" ("promotionId", "productId")
SELECT pr."id",
  p."id"
FROM (
    VALUES ('KM-KEM-HE', 'TH-ICECREAM-SOCOLA'),
      ('KM-SOCOLA-SAP-TOI', 'TH-MILK-SOCOLA-180ML'),
      ('KM-SOCOLA-SAP-TOI', 'TH-ICECREAM-SOCOLA')
  ) AS v(promo, pcode)
  JOIN "promotions" pr ON pr."code" = v.promo
  JOIN "products" p ON p."code" = v.pcode;
-- =============================================================================
-- HÓA ĐƠN (đủ 4 trạng thái; thanh toán tiền mặt, chuyển khoản, thẻ, hỗn hợp)
--   HD-0001 completed : tiền mặt, có tiền thối
--   HD-0002 completed : hỗn hợp tiền mặt + chuyển khoản, có khuyến mãi nhóm + mã giảm giá
--   HD-0003 completed : thẻ, xả hàng lô sắp hết hạn
--   HD-0004 pending_payment : chuyển khoản chưa được xác nhận
--   HD-0005 draft     : hóa đơn nháp
--   HD-0006 cancelled : thẻ bị từ chối, khách hủy
--   HD-0007 completed : khuyến mãi theo hóa đơn
-- =============================================================================
INSERT INTO "invoices" (
    "code",
    "cashierId",
    "subtotal",
    "discountAmount",
    "finalTotal",
    "status",
    "notes",
    "createdAt",
    "paidAt"
  )
SELECT v.code,
  s."id",
  v.subtotal,
  v.discount,
  v.final_total,
  v.status::"InvoiceStatus",
  v.notes,
  NOW() - make_interval(mins => v.created_ago_min),
  CASE
    WHEN v.paid_after_min IS NULL THEN NULL
    ELSE NOW() - make_interval(mins => v.created_ago_min - v.paid_after_min)
  END
FROM (
    VALUES (
        'HD-0001',
        'NV002',
        96000,
        0,
        96000,
        'completed',
        NULL::text,
        4320,
        3
      ),
      (
        'HD-0002',
        'NV002',
        250000,
        34000,
        216000,
        'completed',
        NULL,
        2880,
        5
      ),
      (
        'HD-0003',
        'NV004',
        173000,
        40500,
        132500,
        'completed',
        NULL,
        1440,
        2
      ),
      (
        'HD-0004',
        'NV002',
        70000,
        0,
        70000,
        'pending_payment',
        'Khách chuyển khoản, chờ xác nhận',
        60,
        NULL
      ),
      (
        'HD-0005',
        'NV004',
        38000,
        0,
        38000,
        'draft',
        NULL,
        5,
        NULL
      ),
      (
        'HD-0006',
        'NV002',
        50000,
        0,
        50000,
        'cancelled',
        'Thẻ bị từ chối, khách đổi ý',
        5760,
        NULL
      ),
      (
        'HD-0007',
        'NV002',
        288000,
        14400,
        273600,
        'completed',
        NULL,
        7200,
        4
      )
  ) AS v(
    code,
    cashier,
    subtotal,
    discount,
    final_total,
    status,
    notes,
    created_ago_min,
    paid_after_min
  )
  JOIN "staff" s ON s."code" = v.cashier;
-- Dòng hóa đơn (giảm giá riêng cho dòng ở cột discount; thành tiền do database tự tính)
INSERT INTO "invoice_items" (
    "invoiceId",
    "productId",
    "batchId",
    "quantity",
    "unitPrice",
    "discount"
  )
SELECT i."id",
  p."id",
  b."id",
  v.qty,
  v.price,
  v.discount
FROM (
    VALUES (
        'HD-0001',
        'TH-MILK-DAU-180ML',
        'L-MD-0926',
        2,
        38000,
        0
      ),
      (
        'HD-0001',
        'TH-JUICE-ORANGE',
        'L-CAM-1026',
        1,
        20000,
        0
      ),
      (
        'HD-0002',
        'TH-YOGURT-ALOE',
        'L-YOG-0926',
        5,
        28000,
        14000
      ),
      (
        'HD-0002',
        'TH-ICECREAM-SOCOLA',
        'L-KEM-0926',
        2,
        25000,
        0
      ),
      (
        'HD-0002',
        'TH-TEA-CHANH',
        'L-TRA-1026',
        4,
        15000,
        0
      ),
      (
        'HD-0003',
        'TH-FRESH-1L',
        'L-FRESH-1026',
        3,
        45000,
        40500
      ),
      (
        'HD-0003',
        'TH-MILK-SOCOLA-180ML',
        'L-MS-0926',
        1,
        38000,
        0
      ),
      (
        'HD-0004',
        'TH-JUICE-ORANGE',
        'L-CAM-1026',
        2,
        20000,
        0
      ),
      (
        'HD-0004',
        'TH-TEA-CHANH',
        'L-TRA-1026',
        2,
        15000,
        0
      ),
      (
        'HD-0005',
        'TH-MILK-DAU-180ML',
        'L-MD-0926',
        1,
        38000,
        0
      ),
      (
        'HD-0006',
        'TH-ICECREAM-SOCOLA',
        'L-KEM-0926',
        2,
        25000,
        0
      ),
      (
        'HD-0007',
        'TH-MILK-DAU-180ML',
        'L-MD-0926',
        4,
        38000,
        0
      ),
      (
        'HD-0007',
        'TH-MILK-SOCOLA-180ML',
        'L-MS-0926',
        2,
        38000,
        0
      ),
      (
        'HD-0007',
        'TH-TEA-CHANH',
        'L-TRA-1026',
        4,
        15000,
        0
      )
  ) AS v(inv, pcode, batch, qty, price, discount)
  JOIN "invoices" i ON i."code" = v.inv
  JOIN "products" p ON p."code" = v.pcode
  JOIN "batches" b ON b."batchCode" = v.batch;
-- Thanh toán (HD-0002 trả hỗn hợp 2 khoản; tiền thối = cashReceived - amount)
INSERT INTO "invoice_payments" (
    "invoiceId",
    "method",
    "amount",
    "cashReceived",
    "status",
    "reference",
    "confirmedById",
    "confirmedAt",
    "createdAt"
  )
SELECT i."id",
  v.method::"PaymentMethod",
  v.amount,
  v.cash_received,
  v.status::"PaymentStatus",
  v.ref,
  s."id",
  CASE
    WHEN v.status = 'confirmed' THEN i."paidAt"
  END,
  i."createdAt"
FROM (
    VALUES (
        'HD-0001',
        'cash',
        96000,
        100000,
        'confirmed',
        NULL::text,
        'NV002'
      ),
      (
        'HD-0002',
        'cash',
        116000,
        120000,
        'confirmed',
        NULL,
        'NV002'
      ),
      (
        'HD-0002',
        'transfer',
        100000,
        NULL,
        'confirmed',
        'FT26100100123',
        'NV002'
      ),
      (
        'HD-0003',
        'card',
        132500,
        NULL,
        'confirmed',
        'POS-AUTH-884211',
        'NV004'
      ),
      (
        'HD-0004',
        'transfer',
        70000,
        NULL,
        'pending',
        NULL,
        NULL
      ),
      (
        'HD-0006',
        'card',
        50000,
        NULL,
        'failed',
        'POS-DECLINED-1002',
        NULL
      ),
      (
        'HD-0007',
        'cash',
        273600,
        300000,
        'confirmed',
        NULL,
        'NV002'
      )
  ) AS v(
    inv,
    method,
    amount,
    cash_received,
    status,
    ref,
    confirmer
  )
  JOIN "invoices" i ON i."code" = v.inv
  LEFT JOIN "staff" s ON s."code" = v.confirmer;
-- Khuyến mãi đã áp dụng (invoiceItemId NULL = giảm trên cả hóa đơn)
INSERT INTO "invoice_promotions" (
    "invoiceId",
    "promotionId",
    "invoiceItemId",
    "discountAmount"
  )
SELECT i."id",
  pr."id",
  ii."id",
  v.amount
FROM (
    VALUES (
        'HD-0002',
        'KM-SUACHUA',
        'TH-YOGURT-ALOE',
        14000
      ),
      ('HD-0002', 'GIAM20K', NULL, 20000),
      ('HD-0003', 'XA-HANG-HSD', 'TH-FRESH-1L', 40500),
      ('HD-0007', 'KM-TUAN-LE', NULL, 14400)
  ) AS v(inv, promo, item_pcode, amount)
  JOIN "invoices" i ON i."code" = v.inv
  JOIN "promotions" pr ON pr."code" = v.promo
  LEFT JOIN "products" p ON p."code" = v.item_pcode
  LEFT JOIN "invoice_items" ii ON ii."invoiceId" = i."id"
  AND ii."productId" = p."id";
-- Số lượt dùng khuyến mãi = số hóa đơn đã hoàn tất có áp dụng
UPDATE "promotions" pr
SET "usedCount" = (
    SELECT COUNT(DISTINCT ip."invoiceId")
    FROM "invoice_promotions" ip
      JOIN "invoices" i ON i."id" = ip."invoiceId"
    WHERE ip."promotionId" = pr."id"
      AND i."status" = 'completed'
  );
-- SỔ KHO 3: bán hàng - chỉ hóa đơn đã hoàn tất mới trừ tồn
INSERT INTO "stock_movements" (
    "batchId",
    "type",
    "quantity",
    "reason",
    "refType",
    "refId",
    "createdById",
    "createdAt"
  )
SELECT ii."batchId",
  'sale',
  - ii."quantity",
  'Bán theo hóa đơn ' || i."code",
  'invoice',
  i."id",
  i."cashierId",
  i."paidAt"
FROM "invoice_items" ii
  JOIN "invoices" i ON i."id" = ii."invoiceId"
WHERE i."status" = 'completed'
ORDER BY i."paidAt";
-- =============================================================================
-- KIỂM KÊ
--   AUD-2026-001 : đã duyệt, lệch 1 que kem -> sinh dòng sổ kho loại 'audit'
--   AUD-2026-002 : đang chờ quản lý duyệt, chưa ảnh hưởng tồn kho
-- =============================================================================
INSERT INTO "stock_audits" (
    "auditCode",
    "auditDate",
    "performedById",
    "approvedById",
    "status"
  )
SELECT v.code,
  NOW() - make_interval(mins => v.ago_min),
  w."id",
  m."id",
  v.status::"StockAuditStatus"
FROM (
    VALUES ('AUD-2026-001', 1440, 'approved', true),
      ('AUD-2026-002', 30, 'pending_approval', false)
  ) AS v(code, ago_min, status, approved)
  JOIN "staff" w ON w."code" = 'NV003'
  LEFT JOIN "staff" m ON m."code" = 'NV001'
  AND v.approved;
-- systemQuantity lấy từ tồn hiện tại của lô; actualQuantity NULL nghĩa là khớp sổ sách
INSERT INTO "stock_audit_items" (
    "auditId",
    "batchId",
    "systemQuantity",
    "actualQuantity",
    "reason"
  )
SELECT a."id",
  b."id",
  b."quantity",
  COALESCE(v.actual, b."quantity"),
  v.reason
FROM (
    VALUES (
        'AUD-2026-001',
        'L-KEM-0926',
        47,
        'Hỏng 1 que do chảy đông'
      ),
      (
        'AUD-2026-001',
        'L-TRA-1026',
        NULL::integer,
        NULL::text
      ),
      (
        'AUD-2026-002',
        'L-MD-0926',
        93,
        'Đếm thiếu 1 lốc, chờ xác minh'
      )
  ) AS v(audit, batch, actual, reason)
  JOIN "stock_audits" a ON a."auditCode" = v.audit
  JOIN "batches" b ON b."batchCode" = v.batch;
-- SỔ KHO 4: kiểm kê đã duyệt thì điều chỉnh tồn theo chênh lệch
INSERT INTO "stock_movements" (
    "batchId",
    "type",
    "quantity",
    "reason",
    "refType",
    "refId",
    "createdById",
    "createdAt"
  )
SELECT sai."batchId",
  'audit',
  sai."difference",
  'Điều chỉnh theo kiểm kê ' || a."auditCode",
  'audit',
  a."id",
  a."approvedById",
  a."auditDate"
FROM "stock_audit_items" sai
  JOIN "stock_audits" a ON a."id" = sai."auditId"
WHERE a."status" = 'approved'
  AND sai."difference" <> 0;
-- =============================================================================
-- THAM SỐ, PHIÊN ĐĂNG NHẬP, NHẬT KÝ ĐĂNG NHẬP
-- =============================================================================
UPDATE "app_settings"
SET "value" = '30'
WHERE "key" = 'expiryAlertDays';
INSERT INTO "auth_sessions" (
    "staffId",
    "refreshTokenHash",
    "userAgent",
    "ipAddress",
    "createdAt",
    "expiresAt",
    "revokedAt"
  )
SELECT s."id",
  v.token,
  'Mozilla/5.0 (mẫu)',
  '192.168.1.10',
  NOW() - make_interval(hours => v.created_ago_h),
  NOW() + make_interval(days => v.expires_in_d),
  CASE
    WHEN v.revoked THEN NOW() - INTERVAL '6 hours'
  END
FROM (
    VALUES ('NV001', 'seed-hash-manager-active', 1, 7, false),
      ('NV002', 'seed-hash-cashier-active', 5, 7, false),
      (
        'NV002',
        'seed-hash-cashier-revoked',
        10,
        7,
        true
      )
  ) AS v(
    staff,
    token,
    created_ago_h,
    expires_in_d,
    revoked
  )
  JOIN "staff" s ON s."code" = v.staff;
INSERT INTO "login_logs" (
    "staffId",
    "username",
    "event",
    "success",
    "reason",
    "ipAddress",
    "createdAt"
  )
SELECT s."id",
  v.username,
  v.event::"LoginEvent",
  v.success,
  v.reason,
  '192.168.1.10',
  NOW() - make_interval(mins => v.ago_min)
FROM (
    VALUES (
        'manager',
        'NV001',
        'login',
        true,
        NULL::text,
        60
      ),
      ('manager', 'NV001', 'logout', true, NULL, 600),
      (
        'cashier',
        'NV002',
        'login',
        false,
        'wrong_password',
        310
      ),
      ('cashier', 'NV002', 'login', true, NULL, 300),
      (
        'nobody',
        NULL,
        'login',
        false,
        'unknown_user',
        200
      )
  ) AS v(username, staff, event, success, reason, ago_min)
  LEFT JOIN "staff" s ON s."code" = v.staff;
-- 5 lần sai mật khẩu liên tiếp rồi tài khoản "locked" bị khóa
INSERT INTO "login_logs" (
    "staffId",
    "username",
    "event",
    "success",
    "reason",
    "ipAddress",
    "createdAt"
  )
SELECT s."id",
  'locked',
  'login',
  false,
  'wrong_password',
  '192.168.1.20',
  NOW() - make_interval(mins => 1500 - g)
FROM generate_series(1, 5) AS g
  JOIN "staff" s ON s."code" = 'NV005';
INSERT INTO "login_logs" (
    "staffId",
    "username",
    "event",
    "success",
    "reason",
    "createdAt"
  )
SELECT s."id",
  'locked',
  'lock',
  true,
  'too_many_failed_attempts',
  NOW() - INTERVAL '1495 minutes'
FROM "staff" s
WHERE s."code" = 'NV005';
COMMIT;