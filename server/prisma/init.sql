-- CẢNH BÁO: hai dòng dưới XÓA TOÀN BỘ bảng và dữ liệu hiện có rồi tạo lại từ đầu.
-- Chỉ chạy file này khi muốn dựng lại database; sau đó chạy data.sql để nạp dữ liệu mẫu.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Bật hàm sinh UUID phía database (dùng làm giá trị mặc định cho cột id)
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
CREATE TYPE "InvoiceStatus" AS ENUM (
  'completed',
  'pending_payment',
  'returned',
  'cancelled',
  'pending_approval'
);
CREATE TYPE "CashSessionStatus" AS ENUM ('open', 'closed', 'reviewed');
CREATE TYPE "StaffRole" AS ENUM ('manager', 'cashier', 'warehouse');
CREATE TYPE "StaffStatus" AS ENUM ('active', 'inactive');
CREATE TYPE "Shift" AS ENUM ('SANG', 'CHIEU', 'HANH_CHINH');
CREATE TYPE "DiscountType" AS ENUM ('percentage', 'fixed_amount');
-- Vòng đời chương trình: draft -> scheduled (chờ tới ngày) -> active -> paused -> expired
CREATE TYPE "PromotionStatus" AS ENUM (
  'draft',
  'scheduled',
  'active',
  'paused',
  'expired'
);
-- Phạm vi áp dụng: cả hóa đơn | một nhóm hàng | sản phẩm chỉ định | lô hàng sắp hết hạn (xả hàng)
CREATE TYPE "PromotionScope" AS ENUM ('order', 'category', 'product', 'near_expiry');
CREATE TYPE "SupplierStatus" AS ENUM ('active', 'inactive');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('pending', 'received', 'cancelled');
CREATE TYPE "StockAuditStatus" AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'rejected'
);
-- =============================================================================
-- VAI TRÒ & QUYỀN (Package 5 - phân quyền RBAC)
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
-- =============================================================================
-- NHÂN VIÊN & TÀI KHOẢN (Package 5)
-- =============================================================================
CREATE TABLE "staff" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "username" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  -- lưu bcrypt hash, KHÔNG lưu plaintext
  "role" "StaffRole" NOT NULL,
  -- giữ để tương thích seed.sql; roleId được đồng bộ tự động
  "roleId" TEXT REFERENCES "roles"("id"),
  "status" "StaffStatus" NOT NULL DEFAULT 'active',
  "shift" "Shift" NOT NULL,
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "passwordChangedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "staff_roleId_idx" ON "staff"("roleId");
-- Tự động đồng bộ staff.roleId theo staff.role (khi INSERT/UPDATE cột role)
CREATE OR REPLACE FUNCTION sync_staff_role_id() RETURNS trigger AS $$ BEGIN IF NEW."roleId" IS NULL
  OR (
    TG_OP = 'UPDATE'
    AND NEW."role" IS DISTINCT
    FROM OLD."role"
  ) THEN
SELECT "id" INTO NEW."roleId"
FROM "roles"
WHERE "code" = NEW."role"::text;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_staff_sync_role_id BEFORE
INSERT
  OR
UPDATE ON "staff" FOR EACH ROW EXECUTE FUNCTION sync_staff_role_id();
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
-- Lịch sử đăng nhập
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
-- Đặt lại mật khẩu
CREATE TABLE "password_reset_tokens" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "staffId" TEXT NOT NULL REFERENCES "staff"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "password_reset_tokens_staffId_idx" ON "password_reset_tokens"("staffId");
-- Dữ liệu khởi tạo: vai trò
INSERT INTO "roles" ("code", "name", "description", "isSystem")
VALUES (
    'manager',
    'Quản lý',
    'Toàn quyền: điều hành cửa hàng, duyệt, quản lý tài khoản và phân quyền',
    true
  ),
  (
    'cashier',
    'Thu ngân',
    'Bán hàng, tra cứu, tích điểm',
    true
  ),
  (
    'warehouse',
    'Thủ kho',
    'Nhập/xuất/kiểm kê kho',
    true
  );
-- Dữ liệu khởi tạo: quyền (bám theo 7 module trong sơ đồ chức năng)
INSERT INTO "permissions" ("code", "module", "name")
VALUES -- Bán hàng (1)
  (
    'product:view',
    'sales',
    'Tra cứu sản phẩm'
  ),
  (
    'invoice:create',
    'sales',
    'Lập hóa đơn, thanh toán'
  ),
  (
    'invoice:view',
    'sales',
    'Xem hóa đơn'
  ),
  (
    'invoice:return',
    'sales',
    'Đề xuất đổi trả/hủy hóa đơn'
  ),
  (
    'invoice:approve',
    'sales',
    'Duyệt đổi trả/hủy hóa đơn'
  ),
  (
    'promotion:apply',
    'promotion',
    'Áp dụng khuyến mãi / nhập mã giảm giá khi bán'
  ),
  (
    'payment:process',
    'sales',
    'Thanh toán hóa đơn (tiền mặt, chuyển khoản, thẻ)'
  ),
  (
    'payment:confirm',
    'sales',
    'Xác nhận đã nhận chuyển khoản/thẻ'
  ),
  (
    'cashsession:manage',
    'sales',
    'Mở ca, kết ca thu ngân'
  ),
  (
    'cashsession:review',
    'sales',
    'Duyệt chênh lệch kết ca'
  ),
  (
    'payment:refund',
    'sales',
    'Duyệt hoàn tiền khi đổi trả/hủy'
  ),
  -- Hàng hóa (2)
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
    'Tạo, sửa, kích hoạt, tạm dừng chương trình khuyến mãi'
  ),
  -- Kho (3)
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
  -- Nhân viên (5)
  (
    'staff:manage',
    'staff',
    'Quản lý tài khoản và phân quyền'
  ),
  (
    'shift:manage',
    'staff',
    'Quản lý ca làm'
  ),
  -- Nhà cung cấp (6)
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
  -- Báo cáo (7)
  (
    'report:view',
    'report',
    'Xem báo cáo, thống kê'
  );
-- manager: tất cả quyền (kể cả quản lý tài khoản và phân quyền)
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
    'invoice:return',
    'promotion:apply',
    'payment:process',
    'payment:confirm',
    'cashsession:manage'
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
-- SẢN PHẨM & LÔ HÀNG (Package 2, 3)
-- =============================================================================
CREATE TABLE "products" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "category" "Category" NOT NULL,
  "unit" TEXT NOT NULL,
  "sellingPrice" DECIMAL(12, 2) NOT NULL,
  "costPrice" DECIMAL(12, 2) NOT NULL,
  "discountPercent" DECIMAL(5, 2) CHECK (
    "discountPercent" >= 0
    AND "discountPercent" <= 100
  ),
  -- % giảm giá riêng của sản phẩm (NULL = không giảm)
  "minStockLevel" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,
  "imageUrl" TEXT,
  "status" "ProductStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "batches" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "batchCode" TEXT NOT NULL UNIQUE,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  "manufacturingDate" TIMESTAMP(3) NOT NULL,
  "expiryDate" TIMESTAMP(3) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "importPrice" DECIMAL(12, 2) NOT NULL,
  "status" "BatchStatus" NOT NULL DEFAULT 'good',
  "receivedById" TEXT REFERENCES "staff"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "batches_productId_idx" ON "batches"("productId");
CREATE INDEX "batches_receivedById_idx" ON "batches"("receivedById");
-- =============================================================================
-- CA THU NGÂN (Package 1 - kiểm soát tiền mặt: mở ca, kết ca, đối soát)
-- expectedCash = openingCash + tiền mặt thu trong ca - tiền mặt hoàn trong ca
-- =============================================================================
CREATE TABLE "cash_sessions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "cashierId" TEXT NOT NULL REFERENCES "staff"("id"),
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openingCash" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  -- tiền lẻ đầu ca
  "closedAt" TIMESTAMP(3),
  "expectedCash" DECIMAL(12, 2),
  -- hệ thống tính khi kết ca
  "countedCash" DECIMAL(12, 2),
  -- thu ngân đếm thực tế
  "difference" DECIMAL(12, 2),
  -- countedCash - expectedCash
  "differenceReason" TEXT,
  "reviewedById" TEXT REFERENCES "staff"("id"),
  -- quản lý duyệt chênh lệch
  "status" "CashSessionStatus" NOT NULL DEFAULT 'open'
);
CREATE INDEX "cash_sessions_cashierId_idx" ON "cash_sessions"("cashierId");
CREATE INDEX "cash_sessions_reviewedById_idx" ON "cash_sessions"("reviewedById");
-- =============================================================================
-- HÓA ĐƠN BÁN HÀNG (Package 1)
-- =============================================================================
CREATE TABLE "invoices" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cashierId" TEXT NOT NULL REFERENCES "staff"("id"),
  "cashSessionId" TEXT REFERENCES "cash_sessions"("id"),
  -- ca thu ngân tạo hóa đơn
  "subtotal" DECIMAL(12, 2) NOT NULL,
  "discountAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "voucherCode" TEXT,
  "finalTotal" DECIMAL(12, 2) NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  -- 'mixed' nếu trả nhiều hình thức
  "receivedAmount" DECIMAL(12, 2) NOT NULL,
  -- tổng tiền khách đưa (gồm cả tiền thừa)
  "changeAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  -- tiền thối lại (chỉ phát sinh với tiền mặt)
  "paidAt" TIMESTAMP(3),
  -- thời điểm thanh toán đủ; NULL = chưa xong
  "status" "InvoiceStatus" NOT NULL DEFAULT 'completed',
  "notes" TEXT
);
CREATE INDEX "invoices_cashierId_idx" ON "invoices"("cashierId");
CREATE INDEX "invoices_cashSessionId_idx" ON "invoices"("cashSessionId");
CREATE TABLE "invoice_items" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoiceId" TEXT NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  "batchId" TEXT REFERENCES "batches"("id"),
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12, 2) NOT NULL,
  "discount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "subtotal" DECIMAL(12, 2) NOT NULL
);
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");
CREATE INDEX "invoice_items_productId_idx" ON "invoice_items"("productId");
CREATE INDEX "invoice_items_batchId_idx" ON "invoice_items"("batchId");
-- Từng khoản thanh toán của hóa đơn (hỗ trợ trả nhiều hình thức: vd 200k tiền mặt + 300k chuyển khoản)
-- Quy tắc: hóa đơn chỉ 'completed' khi tổng amount (status='confirmed') >= finalTotal
CREATE TABLE "invoice_payments" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoiceId" TEXT NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "method" "PaymentMethod" NOT NULL,
  -- cash | transfer | card (không dùng 'mixed')
  "amount" DECIMAL(12, 2) NOT NULL,
  -- số tiền tính vào hóa đơn (đã trừ tiền thối)
  "status" "PaymentStatus" NOT NULL DEFAULT 'confirmed',
  "reference" TEXT,
  -- mã giao dịch chuyển khoản / mã chuẩn chi thẻ
  "confirmedById" TEXT REFERENCES "staff"("id"),
  -- người xác nhận đã nhận tiền
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("amount" > 0)
);
CREATE INDEX "invoice_payments_invoiceId_idx" ON "invoice_payments"("invoiceId");
CREATE INDEX "invoice_payments_confirmedById_idx" ON "invoice_payments"("confirmedById");
CREATE INDEX "invoice_payments_reference_idx" ON "invoice_payments"("reference");
-- Lưu vết bước "quản lý xác nhận" khi đổi trả/hủy hóa đơn (theo khảo sát câu 10)
CREATE TABLE "invoice_approvals" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoiceId" TEXT NOT NULL REFERENCES "invoices"("id"),
  "action" TEXT NOT NULL,
  -- 'return' | 'cancel'
  "reason" TEXT NOT NULL,
  "refundAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  -- số tiền hoàn lại cho khách
  "refundMethod" "PaymentMethod",
  -- hoàn bằng cash | transfer | card
  "refundRef" TEXT,
  -- mã giao dịch hoàn tiền (nếu chuyển khoản)
  "approvedById" TEXT NOT NULL REFERENCES "staff"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "invoice_approvals_invoiceId_idx" ON "invoice_approvals"("invoiceId");
CREATE INDEX "invoice_approvals_approvedById_idx" ON "invoice_approvals"("approvedById");
-- =============================================================================
-- CHƯƠNG TRÌNH KHUYẾN MÃI & ƯU ĐÃI (Package 2)
-- Bắt đầu từ Quản lý: tạo chương trình -> đặt phạm vi/điều kiện/thời gian -> kích hoạt.
-- Khi bán: hệ thống tự tìm chương trình đang 'active' phù hợp (requiresCode = false),
-- hoặc thu ngân nhập mã giảm giá (requiresCode = true, dùng cột code làm mã voucher).
-- =============================================================================
CREATE TABLE "promotions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  -- mã chương trình / mã voucher
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
  -- dùng khi scope = 'category'
  "nearExpiryDays" INTEGER,
  -- scope = 'near_expiry': lô còn <= N ngày hạn dùng
  "requiresCode" BOOLEAN NOT NULL DEFAULT false,
  -- true: phải nhập mã; false: tự động áp dụng
  "usageLimit" INTEGER,
  -- tổng số lượt dùng tối đa (NULL = không giới hạn)
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "status" "PromotionStatus" NOT NULL DEFAULT 'scheduled',
  "createdById" TEXT REFERENCES "staff"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("endDate" > "startDate")
);
CREATE INDEX "promotions_status_idx" ON "promotions"("status");
CREATE INDEX "promotions_createdById_idx" ON "promotions"("createdById");
-- Sản phẩm được áp dụng khi scope = 'product' (hoặc giới hạn thêm cho 'near_expiry')
CREATE TABLE "promotion_products" (
  "promotionId" TEXT NOT NULL REFERENCES "promotions"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  PRIMARY KEY ("promotionId", "productId")
);
CREATE INDEX "promotion_products_productId_idx" ON "promotion_products"("productId");
-- Khuyến mãi đã áp dụng vào hóa đơn (phục vụ báo cáo hiệu quả chương trình)
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
-- NHÀ CUNG CẤP & ĐƠN ĐẶT HÀNG (Package 6)
-- =============================================================================
CREATE TABLE "suppliers" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "contactPerson" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "categoryProvided" TEXT NOT NULL,
  "status" "SupplierStatus" NOT NULL DEFAULT 'active'
);
CREATE TABLE "purchase_orders" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderCode" TEXT NOT NULL UNIQUE,
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
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12, 2) NOT NULL,
  "subtotal" DECIMAL(12, 2) NOT NULL
);
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");
CREATE INDEX "purchase_order_items_productId_idx" ON "purchase_order_items"("productId");
-- =============================================================================
-- KIỂM KÊ KHO (Package 3 - có bước quản lý duyệt theo khảo sát câu 11)
-- =============================================================================
CREATE TABLE "stock_audits" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "auditCode" TEXT NOT NULL UNIQUE,
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
-- =============================================================================
-- Xong phần tạo bảng. Dữ liệu mẫu để chạy thử nằm ở file riêng: data.sql
-- Chạy tiếp bằng: psql -U postgres -d th_true_mart -f data.sql
-- (trigger tự gán staff.roleId theo cột role)
-- =============================================================================