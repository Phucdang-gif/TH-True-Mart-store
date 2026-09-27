-- =============================================================================
-- TH TRUE MART - SCRIPT KHỞI TẠO DATABASE (PostgreSQL)
-- Khớp 100% với prisma/schema.prisma đã thiết kế trước đó.
-- Chạy trực tiếp bằng psql hoặc pgAdmin, KHÔNG cần cài Prisma CLI.
--
-- Cách chạy:
--   psql -U postgres -d th_true_mart -f init.sql
-- (nếu database th_true_mart chưa tồn tại, tạo trước bằng: CREATE DATABASE th_true_mart;)
-- =============================================================================

-- Bật hàm sinh UUID phía database (dùng làm giá trị mặc định cho cột id)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE "Category" AS ENUM (
  'SUA_TUOI_TIET_TRUNG', 'SUA_TUOI_THANH_TRUNG', 'SUA_CHUA',
  'BO_PHOMAI', 'KEM', 'NUOC', 'TRA'
);

CREATE TYPE "ProductStatus" AS ENUM ('active', 'discontinued');
CREATE TYPE "BatchStatus" AS ENUM ('good', 'expiring_soon', 'expired');
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'transfer', 'card');
CREATE TYPE "InvoiceStatus" AS ENUM ('completed', 'returned', 'cancelled', 'pending_approval');
CREATE TYPE "CustomerTier" AS ENUM ('Standard', 'Silver', 'Gold', 'Diamond');
CREATE TYPE "StaffRole" AS ENUM ('admin', 'manager', 'cashier', 'warehouse');
CREATE TYPE "StaffStatus" AS ENUM ('active', 'inactive');
CREATE TYPE "Shift" AS ENUM ('SANG', 'CHIEU', 'HANH_CHINH');
CREATE TYPE "DiscountType" AS ENUM ('percentage', 'fixed_amount');
CREATE TYPE "PromotionStatus" AS ENUM ('active', 'expired', 'scheduled');
CREATE TYPE "SupplierStatus" AS ENUM ('active', 'inactive');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('pending', 'received', 'cancelled');
CREATE TYPE "StockAuditStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'rejected');

-- =============================================================================
-- NHÂN VIÊN & TÀI KHOẢN (Package 5)
-- =============================================================================

CREATE TABLE "staff" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code"      TEXT NOT NULL UNIQUE,
  "name"      TEXT NOT NULL,
  "phone"     TEXT NOT NULL,
  "email"     TEXT NOT NULL UNIQUE,
  "username"  TEXT NOT NULL UNIQUE,
  "password"  TEXT NOT NULL,             -- lưu bcrypt hash, KHÔNG lưu plaintext
  "role"      "StaffRole" NOT NULL,
  "status"    "StaffStatus" NOT NULL DEFAULT 'active',
  "shift"     "Shift" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SẢN PHẨM & LÔ HÀNG (Package 2, 3)
-- =============================================================================

CREATE TABLE "products" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code"            TEXT NOT NULL UNIQUE,
  "name"            TEXT NOT NULL,
  "category"        "Category" NOT NULL,
  "unit"            TEXT NOT NULL,
  "sellingPrice"    DECIMAL(12,2) NOT NULL,
  "costPrice"       DECIMAL(12,2) NOT NULL,
  "barcode"         TEXT NOT NULL UNIQUE,
  "minStockLevel"   INTEGER NOT NULL DEFAULT 0,
  "description"     TEXT,
  "imageUrl"        TEXT,
  "status"          "ProductStatus" NOT NULL DEFAULT 'active',
  "discountPercent" DECIMAL(5,2),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "batches" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "batchCode"         TEXT NOT NULL UNIQUE,
  "productId"         TEXT NOT NULL REFERENCES "products"("id"),
  "manufacturingDate" TIMESTAMP(3) NOT NULL,
  "expiryDate"        TIMESTAMP(3) NOT NULL,
  "quantity"          INTEGER NOT NULL,
  "importPrice"       DECIMAL(12,2) NOT NULL,
  "status"            "BatchStatus" NOT NULL DEFAULT 'good',
  "receivedById"      TEXT REFERENCES "staff"("id"),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "batches_productId_idx" ON "batches"("productId");
CREATE INDEX "batches_receivedById_idx" ON "batches"("receivedById");

-- =============================================================================
-- KHÁCH HÀNG THÀNH VIÊN (Package 4)
-- =============================================================================

CREATE TABLE "customers" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code"       TEXT NOT NULL UNIQUE,
  "name"       TEXT NOT NULL,
  "phone"      TEXT NOT NULL UNIQUE,
  "email"      TEXT,
  "points"     INTEGER NOT NULL DEFAULT 0,
  "tier"       "CustomerTier" NOT NULL DEFAULT 'Standard',
  "totalSpent" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- HÓA ĐƠN BÁN HÀNG (Package 1)
-- =============================================================================

CREATE TABLE "invoices" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code"           TEXT NOT NULL UNIQUE,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cashierId"      TEXT NOT NULL REFERENCES "staff"("id"),
  "customerId"     TEXT REFERENCES "customers"("id"),
  "subtotal"       DECIMAL(12,2) NOT NULL,
  "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "voucherCode"    TEXT,
  "pointsUsed"     INTEGER NOT NULL DEFAULT 0,
  "pointsEarned"   INTEGER NOT NULL DEFAULT 0,
  "finalTotal"     DECIMAL(12,2) NOT NULL,
  "paymentMethod"  "PaymentMethod" NOT NULL,
  "receivedAmount" DECIMAL(12,2) NOT NULL,
  "changeAmount"   DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status"         "InvoiceStatus" NOT NULL DEFAULT 'completed',
  "notes"          TEXT
);
CREATE INDEX "invoices_cashierId_idx" ON "invoices"("cashierId");
CREATE INDEX "invoices_customerId_idx" ON "invoices"("customerId");

CREATE TABLE "invoice_items" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoiceId" TEXT NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "products"("id"),
  "batchId"   TEXT REFERENCES "batches"("id"),
  "quantity"  INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "discount"  DECIMAL(12,2) NOT NULL DEFAULT 0,
  "subtotal"  DECIMAL(12,2) NOT NULL
);
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");
CREATE INDEX "invoice_items_productId_idx" ON "invoice_items"("productId");
CREATE INDEX "invoice_items_batchId_idx" ON "invoice_items"("batchId");

-- Lưu vết bước "quản lý xác nhận" khi đổi trả/hủy hóa đơn (theo khảo sát câu 10)
CREATE TABLE "invoice_approvals" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoiceId"    TEXT NOT NULL REFERENCES "invoices"("id"),
  "action"       TEXT NOT NULL,     -- 'return' | 'cancel'
  "reason"       TEXT NOT NULL,
  "approvedById" TEXT NOT NULL REFERENCES "staff"("id"),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "invoice_approvals_invoiceId_idx" ON "invoice_approvals"("invoiceId");
CREATE INDEX "invoice_approvals_approvedById_idx" ON "invoice_approvals"("approvedById");

-- =============================================================================
-- KHUYẾN MÃI (Package 2)
-- =============================================================================

CREATE TABLE "promotions" (
  "id"                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code"               TEXT NOT NULL UNIQUE,
  "name"               TEXT NOT NULL,
  "discountType"       "DiscountType" NOT NULL,
  "value"              DECIMAL(12,2) NOT NULL,
  "startDate"          TIMESTAMP(3) NOT NULL,
  "endDate"            TIMESTAMP(3) NOT NULL,
  "minOrderValue"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  "applicableCategory" "Category",
  "status"             "PromotionStatus" NOT NULL DEFAULT 'scheduled',
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- NHÀ CUNG CẤP & ĐƠN ĐẶT HÀNG (Package 6)
-- =============================================================================

CREATE TABLE "suppliers" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code"             TEXT NOT NULL UNIQUE,
  "name"             TEXT NOT NULL,
  "contactPerson"    TEXT NOT NULL,
  "phone"            TEXT NOT NULL,
  "email"            TEXT NOT NULL,
  "address"          TEXT NOT NULL,
  "categoryProvided" TEXT NOT NULL,
  "status"           "SupplierStatus" NOT NULL DEFAULT 'active'
);

CREATE TABLE "purchase_orders" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderCode"    TEXT NOT NULL UNIQUE,
  "supplierId"   TEXT NOT NULL REFERENCES "suppliers"("id"),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedDate" TIMESTAMP(3) NOT NULL,
  "totalAmount"  DECIMAL(14,2) NOT NULL,
  "status"       "PurchaseOrderStatus" NOT NULL DEFAULT 'pending',
  "notes"        TEXT
);
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");

CREATE TABLE "purchase_order_items" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "purchaseOrderId" TEXT NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
  "productId"       TEXT NOT NULL REFERENCES "products"("id"),
  "quantity"        INTEGER NOT NULL,
  "unitPrice"       DECIMAL(12,2) NOT NULL,
  "subtotal"        DECIMAL(12,2) NOT NULL
);
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");
CREATE INDEX "purchase_order_items_productId_idx" ON "purchase_order_items"("productId");

-- =============================================================================
-- KIỂM KÊ KHO (Package 3 - có bước quản lý duyệt theo khảo sát câu 11)
-- =============================================================================

CREATE TABLE "stock_audits" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "auditCode"     TEXT NOT NULL UNIQUE,
  "auditDate"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "performedById" TEXT NOT NULL REFERENCES "staff"("id"),
  "approvedById"  TEXT REFERENCES "staff"("id"),
  "status"        "StockAuditStatus" NOT NULL DEFAULT 'draft',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "stock_audits_performedById_idx" ON "stock_audits"("performedById");
CREATE INDEX "stock_audits_approvedById_idx" ON "stock_audits"("approvedById");

CREATE TABLE "stock_audit_items" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "stockAuditId"   TEXT NOT NULL REFERENCES "stock_audits"("id") ON DELETE CASCADE,
  "productId"      TEXT NOT NULL REFERENCES "products"("id"),
  "systemQuantity" INTEGER NOT NULL,
  "actualQuantity" INTEGER NOT NULL,
  "difference"     INTEGER NOT NULL,
  "reason"         TEXT NOT NULL
);
CREATE INDEX "stock_audit_items_stockAuditId_idx" ON "stock_audit_items"("stockAuditId");
CREATE INDEX "stock_audit_items_productId_idx" ON "stock_audit_items"("productId");

-- =============================================================================
-- Xong phần tạo bảng. Dữ liệu mẫu để chạy thử nằm ở file riêng: seed.sql
-- Chạy tiếp bằng: psql -U postgres -d th_true_mart -f seed.sql
-- =============================================================================
