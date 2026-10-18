-- =============================================================================
-- init.sql - Cấu trúc database TH True Mart (PostgreSQL 13+)
-- Thiết kế bám theo BFD trong báo cáo: 7 nhóm chức năng, 24 chức năng con.
--
-- Cách chạy trên database TRỐNG:
--   psql -U postgres -d th_true_mart -v ON_ERROR_STOP=1 -f init.sql
--   psql -U postgres -d th_true_mart -v ON_ERROR_STOP=1 -f data.sql
-- Muốn dựng lại từ đầu trên database đã có dữ liệu: chạy reset_dev.sql TRƯỚC
-- (reset_dev.sql XÓA SẠCH mọi bảng và dữ liệu - chỉ dùng khi phát triển).
-- =============================================================================
-- TẠO MỚI DATABASE (XÓA NẾU ĐÃ TỒN TẠI)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- =============================================================================
-- gen_random_uuid() có sẵn từ PostgreSQL 13, không cần extension pgcrypto.
-- =============================================================================
-- ENUMS
-- =============================================================================
CREATE TYPE "ProductStatus" AS ENUM ('active', 'discontinued');
CREATE TYPE "CategoryStatus" AS ENUM ('active', 'inactive');
CREATE TYPE "StaffStatus" AS ENUM ('active', 'inactive');
CREATE TYPE "SupplierStatus" AS ENUM ('active', 'inactive');
-- Sự kiện ghi trong nhật ký đăng nhập (BFD 5.1, 5.4)
CREATE TYPE "LoginEvent" AS ENUM ('login', 'logout', 'lock', 'unlock');
-- Từng khoản thanh toán; trả hỗn hợp = nhiều dòng invoice_payments (BFD 1.4)
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'transfer', 'card');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'confirmed', 'failed');
-- draft: hóa đơn nháp | pending_payment: chờ nhận tiền | completed: đã thanh toán | cancelled: đã hủy
CREATE TYPE "InvoiceStatus" AS ENUM (
  'draft',
  'pending_payment',
  'completed',
  'cancelled'
);
CREATE TYPE "DiscountType" AS ENUM ('percentage', 'fixed_amount');
-- Vòng đời chương trình (BFD 3.4): draft -> scheduled -> active -> paused -> expired
CREATE TYPE "PromotionStatus" AS ENUM (
  'draft',
  'scheduled',
  'active',
  'paused',
  'expired'
);
-- Phạm vi: cả hóa đơn | nhóm hàng | sản phẩm chỉ định | lô sắp hết hạn (xả hàng, BFD 3.3)
CREATE TYPE "PromotionScope" AS ENUM ('order', 'category', 'product', 'near_expiry');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('pending', 'received', 'cancelled');
CREATE TYPE "StockAuditStatus" AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'rejected'
);
-- Loại biến động tồn kho (sổ kho)
CREATE TYPE "StockMovementType" AS ENUM ('import', 'sale', 'export', 'adjust', 'audit');
-- =============================================================================
-- NHÓM 5. NHÂN VIÊN, VAI TRÒ, PHÂN QUYỀN
-- =============================================================================
CREATE TABLE "roles" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
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
  -- sales | product | promotion | inventory | staff | supplier | report | system
  "name" TEXT NOT NULL,
  "description" TEXT
);
CREATE TABLE "role_permissions" (
  "roleId" TEXT NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permissionId" TEXT NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  PRIMARY KEY ("roleId", "permissionId")
);
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");
CREATE TABLE "staff" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "username" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  -- lưu bcrypt hash, KHÔNG lưu mật khẩu thô
  "roleId" TEXT NOT NULL REFERENCES "roles"("id"),
  "status" "StaffStatus" NOT NULL DEFAULT 'active',
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "staff_roleId_idx" ON "staff"("roleId");
-- Phiên đăng nhập / refresh token (BFD 5.1)
CREATE TABLE "auth_sessions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "staffId" TEXT NOT NULL REFERENCES "staff"("id") ON DELETE CASCADE,
  "refreshTokenHash" TEXT NOT NULL UNIQUE,
  -- chỉ lưu hash của token
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  -- NULL = còn hiệu lực; có giá trị = đã đăng xuất / bị khóa
  CHECK ("expiresAt" > "createdAt")
);
CREATE INDEX "auth_sessions_staffId_idx" ON "auth_sessions"("staffId");
-- Nhật ký đăng nhập, đăng xuất, khóa/mở khóa (BFD 5.4)
CREATE TABLE "login_logs" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "staffId" TEXT REFERENCES "staff"("id") ON DELETE
  SET NULL,
    -- NULL nếu đăng nhập sai username
    "username" TEXT NOT NULL,
    "event" "LoginEvent" NOT NULL DEFAULT 'login',
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    -- wrong_password | locked | inactive ...
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "login_logs_staffId_idx" ON "login_logs"("staffId");
CREATE INDEX "login_logs_createdAt_idx" ON "login_logs"("createdAt");
-- =============================================================================
-- NHÓM 2. HÀNG HÓA
-- =============================================================================
-- Nhóm sản phẩm là dữ liệu (không phải enum) để Quản lý tự thêm/sửa/ngừng (BFD 2.1)
CREATE TABLE "Category" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL UNIQUE,
  "status" "CategoryStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "products" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL REFERENCES "Category"("id"),
  "unit" TEXT NOT NULL,
  "sellingPrice" DECIMAL(12, 2) NOT NULL CHECK ("sellingPrice" > 0),
  "costPrice" DECIMAL(12, 2) NOT NULL CHECK ("costPrice" >= 0),
  "minStockLevel" INTEGER NOT NULL DEFAULT 0 CHECK ("minStockLevel" >= 0),
  "description" TEXT,
  "imageUrl" TEXT,
  "status" "ProductStatus" NOT NULL DEFAULT 'active',
  -- discontinued: không bán được nhưng vẫn giữ lịch sử
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");
-- Lịch sử thay đổi giá bán (BFD 2.2). Ứng dụng ghi 1 dòng mỗi lần đổi products.sellingPrice
CREATE TABLE "price_history" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  "oldPrice" DECIMAL(12, 2),
  -- NULL = lần đặt giá đầu tiên
  "newPrice" DECIMAL(12, 2) NOT NULL CHECK ("newPrice" > 0),
  "changedById" TEXT NOT NULL REFERENCES "staff"("id"),
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "price_history_product_idx" ON "price_history"("productId", "changedAt");
CREATE INDEX "price_history_changedById_idx" ON "price_history"("changedById");
-- =============================================================================
-- NHÓM 6. NHÀ CUNG CẤP & ĐƠN ĐẶT HÀNG
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
  "createdById" TEXT NOT NULL REFERENCES "staff"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedDate" TIMESTAMP(3) NOT NULL,
  "totalAmount" DECIMAL(14, 2) NOT NULL CHECK ("totalAmount" >= 0),
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'pending',
  "notes" TEXT
);
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");
CREATE INDEX "purchase_orders_createdById_idx" ON "purchase_orders"("createdById");
CREATE TABLE "purchase_order_items" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "purchaseOrderId" TEXT NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  "unitPrice" DECIMAL(12, 2) NOT NULL CHECK ("unitPrice" >= 0),
  "subtotal" DECIMAL(14, 2) GENERATED ALWAYS AS ("quantity" * "unitPrice") STORED
);
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");
CREATE INDEX "purchase_order_items_productId_idx" ON "purchase_order_items"("productId");
-- =============================================================================
-- NHÓM 4. KHO: LÔ HÀNG, PHIẾU NHẬP, SỔ KHO, KIỂM KÊ
-- =============================================================================
-- Lô hàng: mỗi lô có hạn dùng riêng. QUY TẮC: "quantity" CHỈ thay đổi qua bảng
-- stock_movements (trigger bên dưới tự cộng/trừ). Khi tạo lô mới hãy để quantity = 0
-- rồi ghi một dòng stock_movements loại 'import'.
CREATE TABLE "batches" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "batchCode" TEXT NOT NULL UNIQUE,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  "manufacturingDate" TIMESTAMP(3) NOT NULL,
  "expiryDate" TIMESTAMP(3) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0 CHECK ("quantity" >= 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("expiryDate" > "manufacturingDate")
);
-- Tình trạng lô (good / expiring_soon / expired) KHÔNG lưu cứng, tính từ expiryDate
-- và ngưỡng app_settings.expiryAlertDays (xem view v_batch_status cuối file).
CREATE INDEX "batches_productId_idx" ON "batches"("productId");
CREATE INDEX "batches_expiryDate_idx" ON "batches"("expiryDate");
-- Phiếu nhập kho (BFD 4.1). purchaseOrderId = NULL nếu hàng về không theo đơn đặt
CREATE TABLE "goods_receipts" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "supplierId" TEXT NOT NULL REFERENCES "suppliers"("id"),
  "purchaseOrderId" TEXT REFERENCES "purchase_orders"("id"),
  "receivedById" TEXT NOT NULL REFERENCES "staff"("id"),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT
);
CREATE INDEX "goods_receipts_supplierId_idx" ON "goods_receipts"("supplierId");
CREATE INDEX "goods_receipts_purchaseOrderId_idx" ON "goods_receipts"("purchaseOrderId");
CREATE INDEX "goods_receipts_receivedById_idx" ON "goods_receipts"("receivedById");
CREATE TABLE "goods_receipt_items" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "receiptId" TEXT NOT NULL REFERENCES "goods_receipts"("id") ON DELETE CASCADE,
  "batchId" TEXT NOT NULL REFERENCES "batches"("id"),
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  "importPrice" DECIMAL(12, 2) NOT NULL CHECK ("importPrice" >= 0),
  UNIQUE ("receiptId", "batchId")
);
CREATE INDEX "goods_receipt_items_batchId_idx" ON "goods_receipt_items"("batchId");
-- SỔ KHO: mỗi lần tồn đổi là một dòng (không sửa, không xóa). Phủ BFD 4.1, 4.2, 4.3
--   import : nhập kho            (quantity > 0, refType = 'receipt')
--   sale   : bán hàng            (quantity < 0, refType = 'invoice')
--   export : xuất hủy/hỏng/hết hạn (quantity < 0)
--   adjust : điều chỉnh thủ công (quantity <> 0, bắt buộc có lý do)
--   audit  : điều chỉnh sau kiểm kê đã duyệt (quantity <> 0, refType = 'audit')
CREATE TABLE "stock_movements" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "batchId" TEXT NOT NULL REFERENCES "batches"("id"),
  "type" "StockMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  -- có dấu: + tăng tồn, - giảm tồn
  "reason" TEXT,
  "refType" TEXT,
  -- receipt | invoice | audit
  "refId" TEXT,
  "createdById" TEXT NOT NULL REFERENCES "staff"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("quantity" <> 0),
  CHECK (
    (
      "type" = 'import'
      AND "quantity" > 0
    )
    OR (
      "type" IN ('sale', 'export')
      AND "quantity" < 0
    )
    OR "type" IN ('adjust', 'audit')
  ),
  CHECK (
    "refType" IS NULL
    OR "refType" IN ('receipt', 'invoice', 'audit')
  ),
  CHECK (
    "type" NOT IN ('export', 'adjust')
    OR NULLIF(BTRIM("reason"), '') IS NOT NULL
  )
);
CREATE INDEX "stock_movements_batch_idx" ON "stock_movements"("batchId", "createdAt");
CREATE INDEX "stock_movements_ref_idx" ON "stock_movements"("refType", "refId");
CREATE INDEX "stock_movements_createdById_idx" ON "stock_movements"("createdById");
-- Kiểm kê (BFD 4.3): thủ kho lập, quản lý duyệt. Kiểm kê theo LÔ.
CREATE TABLE "stock_audits" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "auditCode" TEXT NOT NULL UNIQUE,
  "auditDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "performedById" TEXT NOT NULL REFERENCES "staff"("id"),
  "approvedById" TEXT REFERENCES "staff"("id"),
  "status" "StockAuditStatus" NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    "status" NOT IN ('approved', 'rejected')
    OR "approvedById" IS NOT NULL
  )
);
CREATE INDEX "stock_audits_performedById_idx" ON "stock_audits"("performedById");
CREATE INDEX "stock_audits_approvedById_idx" ON "stock_audits"("approvedById");
CREATE TABLE "stock_audit_items" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "auditId" TEXT NOT NULL REFERENCES "stock_audits"("id") ON DELETE CASCADE,
  "batchId" TEXT NOT NULL REFERENCES "batches"("id"),
  "systemQuantity" INTEGER NOT NULL CHECK ("systemQuantity" >= 0),
  "actualQuantity" INTEGER NOT NULL CHECK ("actualQuantity" >= 0),
  "difference" INTEGER GENERATED ALWAYS AS ("actualQuantity" - "systemQuantity") STORED,
  "reason" TEXT,
  -- bắt buộc giải thích khi có chênh lệch
  UNIQUE ("auditId", "batchId"),
  CHECK (
    "actualQuantity" = "systemQuantity"
    OR NULLIF(BTRIM("reason"), '') IS NOT NULL
  )
);
CREATE INDEX "stock_audit_items_batchId_idx" ON "stock_audit_items"("batchId");
-- Tham số hệ thống (vd ngưỡng cảnh báo hàng sắp hết hạn - BFD 4.4)
CREATE TABLE "app_settings" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL,
  "description" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- =============================================================================
-- NHÓM 3. KHUYẾN MÃI, ƯU ĐÃI
-- Quản lý tạo chương trình -> đặt phạm vi/điều kiện/thời gian -> kích hoạt.
-- requiresCode = false: tự áp dụng khi bán; true: thu ngân nhập mã (cột code là mã voucher)
-- =============================================================================
CREATE TABLE "promotions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "scope" "PromotionScope" NOT NULL DEFAULT 'order',
  "discountType" "DiscountType" NOT NULL,
  "value" DECIMAL(12, 2) NOT NULL CHECK ("value" > 0),
  "maxDiscountAmount" DECIMAL(12, 2),
  -- trần giảm khi giảm theo % (NULL = không giới hạn)
  "minOrderValue" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "categoryId" TEXT REFERENCES "Category"("id"),
  -- bắt buộc khi scope = 'category'
  "nearExpiryDays" INTEGER CHECK ("nearExpiryDays" > 0),
  -- bắt buộc khi scope = 'near_expiry': lô còn <= N ngày hạn dùng
  "requiresCode" BOOLEAN NOT NULL DEFAULT false,
  "usageLimit" INTEGER CHECK ("usageLimit" > 0),
  -- tổng lượt dùng tối đa (NULL = không giới hạn)
  "usedCount" INTEGER NOT NULL DEFAULT 0 CHECK ("usedCount" >= 0),
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" "PromotionStatus" NOT NULL DEFAULT 'scheduled',
  "statusChangedAt" TIMESTAMP(3),
  -- thời điểm đổi trạng thái gần nhất (BFD 3.4)
  "createdById" TEXT NOT NULL REFERENCES "staff"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("endDate" > "startDate"),
  CHECK (
    "discountType" <> 'percentage'
    OR "value" <= 100
  ),
  CHECK (
    "scope" <> 'category'
    OR "categoryId" IS NOT NULL
  ),
  CHECK (
    "scope" <> 'near_expiry'
    OR "nearExpiryDays" IS NOT NULL
  ),
  CHECK (
    "usageLimit" IS NULL
    OR "usedCount" <= "usageLimit"
  )
);
CREATE INDEX "promotions_status_idx" ON "promotions"("status");
CREATE INDEX "promotions_categoryId_idx" ON "promotions"("categoryId");
CREATE INDEX "promotions_createdById_idx" ON "promotions"("createdById");
-- Sản phẩm áp dụng khi scope = 'product' (hoặc giới hạn thêm cho 'near_expiry')
CREATE TABLE "promotion_products" (
  "promotionId" TEXT NOT NULL REFERENCES "promotions"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  PRIMARY KEY ("promotionId", "productId")
);
CREATE INDEX "promotion_products_productId_idx" ON "promotion_products"("productId");
-- =============================================================================
-- NHÓM 1. BÁN HÀNG & THANH TOÁN
-- =============================================================================
CREATE TABLE "invoices" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "cashierId" TEXT NOT NULL REFERENCES "staff"("id"),
  "subtotal" DECIMAL(12, 2) NOT NULL CHECK ("subtotal" >= 0),
  -- tạm tính = tổng quantity * unitPrice của các dòng
  "discountAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK ("discountAmount" >= 0),
  -- tổng giảm giá = tổng invoice_promotions.discountAmount
  "finalTotal" DECIMAL(12, 2) NOT NULL CHECK ("finalTotal" >= 0),
  "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  -- thời điểm thanh toán đủ
  CHECK ("finalTotal" = "subtotal" - "discountAmount"),
  CHECK (
    "status" <> 'completed'
    OR "paidAt" IS NOT NULL
  )
);
CREATE INDEX "invoices_cashierId_idx" ON "invoices"("cashierId");
CREATE INDEX "invoices_status_idx" ON "invoices"("status");
CREATE INDEX "invoices_paidAt_idx" ON "invoices"("paidAt");
CREATE TABLE "invoice_items" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoiceId" TEXT NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  "batchId" TEXT NOT NULL REFERENCES "batches"("id"),
  -- bán từ lô nào (tồn kho quản lý theo lô)
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  "unitPrice" DECIMAL(12, 2) NOT NULL CHECK ("unitPrice" >= 0),
  "discount" DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK ("discount" >= 0),
  -- giảm giá áp riêng cho dòng này
  "subtotal" DECIMAL(12, 2) GENERATED ALWAYS AS ("quantity" * "unitPrice" - "discount") STORED,
  CHECK ("discount" <= "quantity" * "unitPrice")
);
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");
CREATE INDEX "invoice_items_productId_idx" ON "invoice_items"("productId");
CREATE INDEX "invoice_items_batchId_idx" ON "invoice_items"("batchId");
-- Từng khoản thanh toán (BFD 1.4). Trả hỗn hợp: vd 200k tiền mặt + 300k chuyển khoản
-- Tiền thối lại = cashReceived - amount (chỉ phát sinh với tiền mặt)
CREATE TABLE "invoice_payments" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoiceId" TEXT NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "method" "PaymentMethod" NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL CHECK ("amount" > 0),
  -- số tiền tính vào hóa đơn (đã trừ tiền thối)
  "cashReceived" DECIMAL(12, 2),
  -- tiền khách đưa, chỉ với method = 'cash'
  "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  "reference" TEXT,
  -- mã giao dịch chuyển khoản / mã chuẩn chi thẻ
  "confirmedById" TEXT REFERENCES "staff"("id"),
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    "cashReceived" IS NULL
    OR (
      "method" = 'cash'
      AND "cashReceived" >= "amount"
    )
  ),
  CHECK (
    "status" <> 'confirmed'
    OR "confirmedAt" IS NOT NULL
  )
);
CREATE INDEX "invoice_payments_invoiceId_idx" ON "invoice_payments"("invoiceId");
CREATE INDEX "invoice_payments_confirmedById_idx" ON "invoice_payments"("confirmedById");
CREATE INDEX "invoice_payments_reference_idx" ON "invoice_payments"("reference");
-- Khuyến mãi / mã giảm giá đã áp dụng vào hóa đơn (phục vụ báo cáo 7.2)
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
-- TRIGGER & HÀM TOÀN VẸN DỮ LIỆU
-- =============================================================================
-- (1) Ghi sổ kho => tự cộng/trừ tồn của lô; từ chối nếu làm tồn âm
CREATE OR REPLACE FUNCTION apply_stock_movement() RETURNS trigger AS $$
DECLARE cur INTEGER;
BEGIN
SELECT "quantity" INTO cur
FROM "batches"
WHERE "id" = NEW."batchId" FOR
UPDATE;
IF cur + NEW."quantity" < 0 THEN RAISE EXCEPTION 'Lô % không đủ tồn: còn %, cần %',
NEW."batchId",
cur,
- NEW."quantity" USING ERRCODE = 'check_violation';
END IF;
UPDATE "batches"
SET "quantity" = cur + NEW."quantity"
WHERE "id" = NEW."batchId";
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_stock_movements_apply
AFTER
INSERT ON "stock_movements" FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();
-- (2) Sổ kho không được sửa/xóa; sai thì ghi dòng điều chỉnh ngược lại
CREATE OR REPLACE FUNCTION forbid_stock_movement_change() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'stock_movements là sổ kho, không được sửa hoặc xóa; hãy ghi dòng điều chỉnh mới' USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_stock_movements_immutable BEFORE
UPDATE
  OR DELETE ON "stock_movements" FOR EACH ROW EXECUTE FUNCTION forbid_stock_movement_change();
-- (3) Hóa đơn 'completed' phải có tổng khoản thanh toán đã xác nhận >= finalTotal.
-- Kiểm tra lúc COMMIT nên có thể tạo hóa đơn và các khoản thanh toán trong cùng transaction.
CREATE OR REPLACE FUNCTION check_invoice_fully_paid() RETURNS trigger AS $$
DECLARE paid NUMERIC;
BEGIN
SELECT COALESCE(SUM("amount"), 0) INTO paid
FROM "invoice_payments"
WHERE "invoiceId" = NEW."id"
  AND "status" = 'confirmed';
IF paid < NEW."finalTotal" THEN RAISE EXCEPTION 'Hóa đơn % chưa thanh toán đủ: đã xác nhận %, cần %',
NEW."code",
paid,
NEW."finalTotal" USING ERRCODE = 'check_violation';
END IF;
RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER trg_invoices_fully_paid
AFTER
INSERT
  OR
UPDATE ON "invoices" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  WHEN (NEW."status" = 'completed') EXECUTE FUNCTION check_invoice_fully_paid();
-- =============================================================================
-- VIEW HỖ TRỢ
-- =============================================================================
-- Tình trạng từng lô, tính từ hạn dùng và ngưỡng cảnh báo (BFD 4.4, báo cáo 7.3)
CREATE VIEW "v_batch_status" AS
SELECT b."id",
  b."batchCode",
  b."productId",
  b."quantity",
  b."expiryDate",
  CASE
    WHEN b."expiryDate" < CURRENT_TIMESTAMP THEN 'expired'
    WHEN b."expiryDate" < CURRENT_TIMESTAMP + make_interval(
      days => COALESCE(
        (
          SELECT "value"::int
          FROM "app_settings"
          WHERE "key" = 'expiryAlertDays'
        ),
        30
      )
    ) THEN 'expiring_soon'
    ELSE 'good'
  END AS "status"
FROM "batches" b;
-- Đối soát: tồn của lô phải bằng tổng sổ kho. Dòng nào trả về = đang lệch.
CREATE VIEW "v_stock_mismatch" AS
SELECT b."id" AS "batchId",
  b."batchCode",
  b."quantity" AS "batchQuantity",
  COALESCE(SUM(m."quantity"), 0)::int AS "ledgerQuantity"
FROM "batches" b
  LEFT JOIN "stock_movements" m ON m."batchId" = b."id"
GROUP BY b."id",
  b."batchCode",
  b."quantity"
HAVING b."quantity" <> COALESCE(SUM(m."quantity"), 0);
-- =============================================================================
-- DỮ LIỆU KHỞI TẠO (bắt buộc để hệ thống chạy): vai trò, quyền, tham số
-- =============================================================================
INSERT INTO "roles" ("code", "name", "description", "isSystem")
VALUES (
    'manager',
    'Quản lý',
    'Toàn quyền: điều hành cửa hàng, duyệt kiểm kê, quản lý tài khoản và phân quyền',
    true
  ),
  (
    'cashier',
    'Thu ngân',
    'Tra cứu sản phẩm, lập hóa đơn, thanh toán',
    true
  ),
  (
    'warehouse',
    'Thủ kho',
    'Nhập/xuất/kiểm kê kho, lập đơn đặt hàng',
    true
  );
-- Quyền bám theo 7 nhóm chức năng trong BFD
INSERT INTO "permissions" ("code", "module", "name")
VALUES -- 1. Bán hàng
  ('product:view', 'sales', 'Tra cứu sản phẩm'),
  ('invoice:create', 'sales', 'Lập hóa đơn'),
  ('invoice:view', 'sales', 'Xem hóa đơn'),
  (
    'invoice:cancel',
    'sales',
    'Hủy hóa đơn nháp / chưa thanh toán'
  ),
  (
    'promotion:apply',
    'sales',
    'Áp dụng khuyến mãi, nhập mã giảm giá'
  ),
  (
    'payment:process',
    'sales',
    'Thanh toán: tiền mặt, chuyển khoản, thẻ, hỗn hợp'
  ),
  (
    'payment:confirm',
    'sales',
    'Xác nhận đã nhận chuyển khoản/thẻ'
  ),
  -- 2. Hàng hóa
  (
    'product:manage',
    'product',
    'Quản lý danh mục sản phẩm'
  ),
  (
    'category:manage',
    'product',
    'Quản lý nhóm sản phẩm'
  ),
  ('product:price', 'product', 'Cập nhật giá bán'),
  -- 3. Khuyến mãi
  (
    'promotion:manage',
    'promotion',
    'Tạo, sửa, kích hoạt, tạm dừng, kết thúc khuyến mãi và mã giảm giá'
  ),
  -- 4. Kho
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
  ('stock:audit', 'inventory', 'Lập phiếu kiểm kê'),
  (
    'stock:audit_approve',
    'inventory',
    'Duyệt kết quả kiểm kê'
  ),
  (
    'stock:alert',
    'inventory',
    'Xem cảnh báo hàng sắp hết hạn'
  ),
  -- 5. Nhân viên
  (
    'staff:manage',
    'staff',
    'Quản lý tài khoản, vai trò, phân quyền, khóa/mở khóa, xem nhật ký đăng nhập'
  ),
  -- 6. Nhà cung cấp
  (
    'supplier:view',
    'supplier',
    'Xem danh sách nhà cung cấp'
  ),
  (
    'supplier:manage',
    'supplier',
    'Quản lý thông tin nhà cung cấp'
  ),
  (
    'purchase:create',
    'supplier',
    'Lập đơn đặt hàng'
  ),
  -- 7. Báo cáo
  ('report:view', 'report', 'Xem báo cáo, thống kê'),
  -- Hệ thống
  (
    'setting:manage',
    'system',
    'Chỉnh tham số hệ thống (ngưỡng cảnh báo...)'
  );
-- manager: tất cả quyền
INSERT INTO "role_permissions"
SELECT r."id",
  p."id"
FROM "roles" r
  CROSS JOIN "permissions" p
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
    'invoice:cancel',
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
    'supplier:view',
    'purchase:create'
  )
WHERE r."code" = 'warehouse';
INSERT INTO "app_settings" ("key", "value", "description")
VALUES (
    'expiryAlertDays',
    '30',
    'Cảnh báo lô hàng còn <= N ngày là hạn dùng (BFD 4.4)'
  );