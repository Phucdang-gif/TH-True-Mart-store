-- =============================================================================
-- TH True Mart - init.sql (bản rút gọn theo báo cáo v10)
-- CẢNH BÁO: hai dòng dưới XÓA TOÀN BỘ bảng và dữ liệu hiện có rồi tạo lại từ đầu.
-- Chỉ chạy khi muốn dựng lại database; sau đó nạp dữ liệu mẫu (data.sql).
-- Không có bảng báo cáo: 4 báo cáo ở mục 7 được tính trực tiếp từ
-- invoices, invoice_items, invoice_promotions, batches, products.
-- =============================================================================
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- =============================================================================
-- ENUMS
-- =============================================================================
CREATE TYPE "Category" AS ENUM (
  'SUA_TUOI_TIET_TRUNG',
  'SUA_TUOI_THANH_TRUNG',
  'SUA_CHUA',
  'BO_PHOMAI',
  'KEM',
  'NUOC',
  'TRA'
);
CREATE TYPE "ProductStatus" AS ENUM ('active', 'discontinued');
CREATE TYPE "BatchStatus" AS ENUM ('good', 'expiring_soon', 'expired');
-- 'mixed' chỉ dùng ở invoices.paymentMethod khi thanh toán nhiều hình thức;
-- từng khoản thực tế nằm trong invoice_payments (cash | transfer | card)
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'transfer', 'card', 'mixed');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'confirmed', 'failed');
-- pending_payment: đang lập/chờ thanh toán; completed: đã thanh toán đủ;
-- cancelled: hủy khi chưa thanh toán
CREATE TYPE "InvoiceStatus" AS ENUM ('completed', 'pending_payment', 'cancelled');
CREATE TYPE "StaffStatus" AS ENUM ('active', 'inactive');
CREATE TYPE "DiscountType" AS ENUM ('percentage', 'fixed_amount');
-- Vòng đời: draft -> scheduled -> active -> paused -> expired
CREATE TYPE "PromotionStatus" AS ENUM (
  'draft',
  'scheduled',
  'active',
  'paused',
  'expired'
);
-- Phạm vi: cả hóa đơn | nhóm hàng | sản phẩm chỉ định | lô sắp hết hạn (xả hàng)
CREATE TYPE "PromotionScope" AS ENUM ('order', 'category', 'product', 'near_expiry');
CREATE TYPE "SupplierStatus" AS ENUM ('active', 'inactive');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('pending', 'received', 'cancelled');
CREATE TYPE "StockAuditStatus" AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'rejected'
);
CREATE TYPE "StockMovementType" AS ENUM ('export', 'adjustment');
-- =============================================================================
-- SINH MÃ TỰ ĐỘNG (NV001, NCC001, PO0001, KK0001)
-- =============================================================================
CREATE SEQUENCE staff_code_seq START 1;
CREATE SEQUENCE supplier_code_seq START 1;
CREATE SEQUENCE po_code_seq START 1;
CREATE SEQUENCE audit_code_seq START 1;
CREATE OR REPLACE FUNCTION next_code(
    p_prefix TEXT,
    p_seq REGCLASS,
    p_pad INT,
    p_table TEXT,
    p_col TEXT
  ) RETURNS TEXT AS $$
DECLARE v_code TEXT;
v_exists BOOLEAN;
BEGIN LOOP v_code := p_prefix || lpad(nextval(p_seq)::text, p_pad, '0');
EXECUTE format(
  'SELECT EXISTS (SELECT 1 FROM %I WHERE %I = $1)',
  p_table,
  p_col
) INTO v_exists USING v_code;
EXIT
WHEN NOT v_exists;
END LOOP;
RETURN v_code;
END;
$$ LANGUAGE plpgsql;
-- =============================================================================
-- 5. QUẢN LÝ NHÂN VIÊN: VAI TRÒ, QUYỀN, TÀI KHOẢN, PHIÊN, NHẬT KÝ ĐĂNG NHẬP
-- =============================================================================
CREATE TABLE "roles" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  -- manager | cashier | warehouse
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  -- vai trò hệ thống: không cho xóa
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "permissions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  -- vd: invoice:create
  "module" TEXT NOT NULL,
  -- sales | product | promotion | inventory | staff | supplier | report
  "name" TEXT NOT NULL,
  "description" TEXT
);
CREATE TABLE "role_permissions" (
  "roleId" TEXT NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permissionId" TEXT NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  PRIMARY KEY ("roleId", "permissionId")
);
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");
-- Vai trò của nhân viên chỉ lưu ở roleId (nguồn duy nhất)
CREATE TABLE "staff" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE DEFAULT next_code('NV', 'staff_code_seq', 3, 'staff', 'code'),
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "username" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  -- bcrypt hash, KHÔNG lưu plaintext
  "roleId" TEXT NOT NULL REFERENCES "roles"("id"),
  "status" "StaffStatus" NOT NULL DEFAULT 'active',
  "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  -- khóa/mở khóa tài khoản
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "staff_roleId_idx" ON "staff"("roleId");
-- Phiên đăng nhập / refresh token
CREATE TABLE "auth_sessions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "staffId" TEXT NOT NULL REFERENCES "staff"("id") ON DELETE CASCADE,
  "refreshTokenHash" TEXT NOT NULL UNIQUE,
  -- chỉ lưu hash của token
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3) -- NULL = còn hiệu lực
);
CREATE INDEX "auth_sessions_staffId_idx" ON "auth_sessions"("staffId");
-- Nhật ký đăng nhập
CREATE TABLE "login_logs" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "staffId" TEXT REFERENCES "staff"("id") ON DELETE
  SET NULL,
    -- NULL nếu sai username
    "username" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    -- wrong_password | locked | inactive ...
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "login_logs_staffId_idx" ON "login_logs"("staffId");
CREATE INDEX "login_logs_createdAt_idx" ON "login_logs"("createdAt");
-- Dữ liệu khởi tạo: vai trò
INSERT INTO "roles" ("code", "name", "description", "isSystem")
VALUES (
    'manager',
    'Quản lý',
    'Có đầy đủ quyền của Thu ngân và Thủ kho; quản trị hệ thống, duyệt kiểm kê, xem báo cáo',
    true
  ),
  (
    'cashier',
    'Thu ngân',
    'Tra cứu sản phẩm, lập hóa đơn, áp dụng khuyến mãi, thanh toán',
    true
  ),
  (
    'warehouse',
    'Thủ kho',
    'Nhập kho, xuất kho, kiểm kê, xem cảnh báo, lập đơn đặt hàng',
    true
  );
-- Dữ liệu khởi tạo: quyền (theo 7 nhóm chức năng trong BFD)
INSERT INTO "permissions" ("code", "module", "name")
VALUES (
    'product:view',
    'sales',
    'Tra cứu sản phẩm'
  ),
  (
    'invoice:create',
    'sales',
    'Lập hóa đơn, in hóa đơn'
  ),
  (
    'invoice:view',
    'sales',
    'Xem hóa đơn'
  ),
  (
    'promotion:apply',
    'promotion',
    'Áp dụng khuyến mãi / nhập mã giảm giá khi bán'
  ),
  (
    'payment:process',
    'sales',
    'Thanh toán hóa đơn (tiền mặt, chuyển khoản, thẻ, hỗn hợp)'
  ),
  (
    'payment:confirm',
    'sales',
    'Xác nhận đã nhận chuyển khoản/thẻ'
  ),
  (
    'product:manage',
    'product',
    'Quản lý danh mục sản phẩm'
  ),
  (
    'product:price',
    'product',
    'Cập nhật giá bán'
  ),
  (
    'promotion:manage',
    'promotion',
    'Tạo, sửa, kích hoạt, tạm dừng, kết thúc khuyến mãi'
  ),
  (
    'batch:import',
    'inventory',
    'Nhập kho (lô, hạn dùng)'
  ),
  (
    'stock:export',
    'inventory',
    'Xuất kho, điều chỉnh'
  ),
  (
    'stock:audit',
    'inventory',
    'Kiểm kê tồn kho'
  ),
  (
    'stock:audit_approve',
    'inventory',
    'Duyệt kiểm kê'
  ),
  (
    'stock:alert',
    'inventory',
    'Xem cảnh báo hàng sắp hết hạn'
  ),
  (
    'staff:manage',
    'staff',
    'Quản lý tài khoản, vai trò, phân quyền, nhật ký đăng nhập'
  ),
  (
    'supplier:manage',
    'supplier',
    'Quản lý nhà cung cấp'
  ),
  (
    'purchase:create',
    'supplier',
    'Lập đơn đặt hàng'
  ),
  (
    'report:view',
    'report',
    'Xem báo cáo, thống kê'
  );
-- manager: tất cả quyền
INSERT INTO "role_permissions"
SELECT r."id",
  p."id"
FROM "roles" r,
  "permissions" p
WHERE r."code" = 'manager';
-- cashier
INSERT INTO "role_permissions"
SELECT r."id",
  p."id"
FROM "roles" r
  JOIN "permissions" p ON p."code" IN (
    'product:view',
    'invoice:create',
    'invoice:view',
    'promotion:apply',
    'payment:process',
    'payment:confirm'
  )
WHERE r."code" = 'cashier';
-- warehouse
INSERT INTO "role_permissions"
SELECT r."id",
  p."id"
FROM "roles" r
  JOIN "permissions" p ON p."code" IN (
    'product:view',
    'batch:import',
    'stock:export',
    'stock:audit',
    'stock:alert',
    'purchase:create'
  )
WHERE r."code" = 'warehouse';
-- =============================================================================
-- 2. QUẢN LÝ HÀNG HÓA; 4. LÔ HÀNG
-- =============================================================================
CREATE TABLE "products" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "category" "Category" NOT NULL,
  "unit" TEXT NOT NULL,
  "sellingPrice" DECIMAL(12, 2) NOT NULL CHECK ("sellingPrice" > 0),
  "minStockLevel" INTEGER NOT NULL DEFAULT 0,
  "status" "ProductStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Lịch sử thay đổi giá bán (mục 2.2)
CREATE TABLE "price_history" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  "oldPrice" DECIMAL(12, 2) NOT NULL,
  "newPrice" DECIMAL(12, 2) NOT NULL CHECK ("newPrice" > 0),
  "changedById" TEXT NOT NULL REFERENCES "staff"("id"),
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "price_history_productId_idx" ON "price_history"("productId");
CREATE INDEX "price_history_changedById_idx" ON "price_history"("changedById");
-- Tồn kho của một sản phẩm = tổng quantity các lô chưa hết hạn
CREATE TABLE "batches" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "batchCode" TEXT NOT NULL UNIQUE,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  "manufacturingDate" TIMESTAMP(3) NOT NULL,
  "expiryDate" TIMESTAMP(3) NOT NULL,
  "quantity" INTEGER NOT NULL CHECK ("quantity" >= 0),
  "importPrice" DECIMAL(12, 2) NOT NULL,
  "status" "BatchStatus" NOT NULL DEFAULT 'good',
  "receivedById" TEXT REFERENCES "staff"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("expiryDate" > "manufacturingDate")
);
CREATE INDEX "batches_productId_idx" ON "batches"("productId");
CREATE INDEX "batches_receivedById_idx" ON "batches"("receivedById");
-- Phiếu xuất kho / điều chỉnh tồn (mục 4.2)
-- quantity là số thay đổi có dấu: xuất kho = số âm, điều chỉnh tăng = số dương
CREATE TABLE "stock_movements" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "batchId" TEXT NOT NULL REFERENCES "batches"("id"),
  "type" "StockMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL CHECK ("quantity" <> 0),
  "reason" TEXT NOT NULL,
  "performedById" TEXT NOT NULL REFERENCES "staff"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "stock_movements_batchId_idx" ON "stock_movements"("batchId");
CREATE INDEX "stock_movements_performedById_idx" ON "stock_movements"("performedById");
-- =============================================================================
-- 1. QUẢN LÝ BÁN HÀNG: HÓA ĐƠN, DÒNG HÀNG, THANH TOÁN
-- =============================================================================
CREATE TABLE "invoices" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cashierId" TEXT NOT NULL REFERENCES "staff"("id"),
  "subtotal" DECIMAL(12, 2) NOT NULL,
  "discountAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "voucherCode" TEXT,
  "finalTotal" DECIMAL(12, 2) NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  -- 'mixed' nếu trả nhiều hình thức
  "receivedAmount" DECIMAL(12, 2) NOT NULL,
  -- tổng tiền khách đưa (gồm cả tiền thừa)
  "changeAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  -- tiền thối lại (chỉ với tiền mặt)
  "paidAt" TIMESTAMP(3),
  -- thanh toán đủ; NULL = chưa xong
  "status" "InvoiceStatus" NOT NULL DEFAULT 'pending_payment'
);
CREATE INDEX "invoices_cashierId_idx" ON "invoices"("cashierId");
CREATE INDEX "invoices_createdAt_idx" ON "invoices"("createdAt");
CREATE TABLE "invoice_items" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoiceId" TEXT NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  "batchId" TEXT REFERENCES "batches"("id"),
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  "unitPrice" DECIMAL(12, 2) NOT NULL,
  -- giá tại thời điểm bán
  "discount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "subtotal" DECIMAL(12, 2) NOT NULL
);
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");
CREATE INDEX "invoice_items_productId_idx" ON "invoice_items"("productId");
CREATE INDEX "invoice_items_batchId_idx" ON "invoice_items"("batchId");
-- Từng khoản thanh toán (vd 200k tiền mặt + 300k chuyển khoản)
-- Hóa đơn chỉ 'completed' khi tổng amount (status='confirmed') >= finalTotal
CREATE TABLE "invoice_payments" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoiceId" TEXT NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "method" "PaymentMethod" NOT NULL,
  -- cash | transfer | card (không dùng 'mixed')
  "amount" DECIMAL(12, 2) NOT NULL,
  -- số tiền tính vào hóa đơn (đã trừ tiền thối)
  "status" "PaymentStatus" NOT NULL DEFAULT 'confirmed',
  "reference" TEXT,
  -- mã giao dịch chuyển khoản / chuẩn chi thẻ
  "confirmedById" TEXT REFERENCES "staff"("id"),
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("amount" > 0)
);
CREATE INDEX "invoice_payments_invoiceId_idx" ON "invoice_payments"("invoiceId");
CREATE INDEX "invoice_payments_confirmedById_idx" ON "invoice_payments"("confirmedById");
CREATE INDEX "invoice_payments_reference_idx" ON "invoice_payments"("reference");
-- =============================================================================
-- 3. KHUYẾN MÃI, ƯU ĐÃI
-- =============================================================================
CREATE TABLE "promotions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  -- mã chương trình / mã giảm giá
  "name" TEXT NOT NULL,
  "description" TEXT,
  "scope" "PromotionScope" NOT NULL DEFAULT 'order',
  "discountType" "DiscountType" NOT NULL,
  "value" DECIMAL(12, 2) NOT NULL CHECK ("value" > 0),
  "maxDiscountAmount" DECIMAL(12, 2),
  -- trần giảm khi giảm theo % (NULL = không giới hạn)
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "minOrderValue" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "applicableCategory" "Category",
  -- khi scope = 'category'
  "nearExpiryDays" INTEGER,
  -- khi scope = 'near_expiry': lô còn <= N ngày
  "requiresCode" BOOLEAN NOT NULL DEFAULT false,
  -- true: phải nhập mã; false: tự động áp dụng
  "usageLimit" INTEGER,
  -- tổng lượt dùng tối đa (NULL = không giới hạn)
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "status" "PromotionStatus" NOT NULL DEFAULT 'scheduled',
  "createdById" TEXT REFERENCES "staff"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("endDate" > "startDate"),
  CHECK ("usedCount" >= 0)
);
CREATE INDEX "promotions_status_idx" ON "promotions"("status");
CREATE INDEX "promotions_createdById_idx" ON "promotions"("createdById");
-- Sản phẩm áp dụng khi scope = 'product' (hoặc giới hạn thêm cho 'near_expiry')
CREATE TABLE "promotion_products" (
  "promotionId" TEXT NOT NULL REFERENCES "promotions"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  PRIMARY KEY ("promotionId", "productId")
);
CREATE INDEX "promotion_products_productId_idx" ON "promotion_products"("productId");
-- Khuyến mãi đã áp dụng vào hóa đơn (dữ liệu gốc để tính báo cáo hiệu quả khuyến mãi)
-- invoiceItemId = NULL nghĩa là giảm trên cả hóa đơn
CREATE TABLE "invoice_promotions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoiceId" TEXT NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "promotionId" TEXT NOT NULL REFERENCES "promotions"("id"),
  "invoiceItemId" TEXT REFERENCES "invoice_items"("id") ON DELETE
  SET NULL,
    "discountAmount" DECIMAL(12, 2) NOT NULL CHECK ("discountAmount" >= 0)
);
CREATE INDEX "invoice_promotions_invoiceId_idx" ON "invoice_promotions"("invoiceId");
CREATE INDEX "invoice_promotions_promotionId_idx" ON "invoice_promotions"("promotionId");
-- =============================================================================
-- 6. QUẢN LÝ NHÀ CUNG CẤP, ĐƠN ĐẶT HÀNG
-- =============================================================================
CREATE TABLE "suppliers" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE DEFAULT next_code(
    'NCC',
    'supplier_code_seq',
    3,
    'suppliers',
    'code'
  ),
  "name" TEXT NOT NULL,
  "contactPerson" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "categoryProvided" TEXT NOT NULL,
  "status" "SupplierStatus" NOT NULL DEFAULT 'active'
);
CREATE TABLE "purchase_orders" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderCode" TEXT NOT NULL UNIQUE DEFAULT next_code(
    'PO',
    'po_code_seq',
    4,
    'purchase_orders',
    'orderCode'
  ),
  "supplierId" TEXT NOT NULL REFERENCES "suppliers"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedDate" TIMESTAMP(3) NOT NULL,
  "totalAmount" DECIMAL(14, 2) NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'pending',
  "notes" TEXT
);
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");
CREATE TABLE "purchase_order_items" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "purchaseOrderId" TEXT NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  "unitPrice" DECIMAL(12, 2) NOT NULL,
  "subtotal" DECIMAL(12, 2) NOT NULL
);
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");
CREATE INDEX "purchase_order_items_productId_idx" ON "purchase_order_items"("productId");
-- =============================================================================
-- 4. KIỂM KÊ TỒN KHO (Thủ kho kiểm, Quản lý duyệt)
-- =============================================================================
CREATE TABLE "stock_audits" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "auditCode" TEXT NOT NULL UNIQUE DEFAULT next_code(
    'KK',
    'audit_code_seq',
    4,
    'stock_audits',
    'auditCode'
  ),
  "auditDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "performedById" TEXT NOT NULL REFERENCES "staff"("id"),
  "approvedById" TEXT REFERENCES "staff"("id"),
  "status" "StockAuditStatus" NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "stock_audits_performedById_idx" ON "stock_audits"("performedById");
CREATE INDEX "stock_audits_approvedById_idx" ON "stock_audits"("approvedById");
CREATE TABLE "stock_audit_items" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "stockAuditId" TEXT NOT NULL REFERENCES "stock_audits"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  "systemQuantity" INTEGER NOT NULL,
  "actualQuantity" INTEGER NOT NULL,
  "difference" INTEGER NOT NULL,
  "reason" TEXT NOT NULL
);
CREATE INDEX "stock_audit_items_stockAuditId_idx" ON "stock_audit_items"("stockAuditId");
CREATE INDEX "stock_audit_items_productId_idx" ON "stock_audit_items"("productId");
-- Xong phần tạo bảng. Nạp dữ liệu mẫu bằng data.sql (cần chỉnh theo schema mới).