\set ON_ERROR_STOP off
\pset pager off
SELECT id AS staff FROM staff ORDER BY code LIMIT 1 \gset
SELECT count(*) AS mismatch_before FROM v_stock_mismatch;

\echo '=== (1) Truy vấn chọn lô FIFO + FOR UPDATE (bỏ lô hết hạn L-CAM-0826) ==='
BEGIN;
SELECT b.id, b."batchCode", b.quantity, b."expiryDate"::date
FROM batches b JOIN products p ON p.id=b."productId"
WHERE p.code IN ('TH-YOGURT-ALOE','TH-JUICE-ORANGE') AND b.quantity > 0 AND b."expiryDate" >= now()
ORDER BY b."expiryDate" ASC, b."createdAt" ASC, b.id ASC FOR UPDATE;
ROLLBACK;

\echo '=== (2) Bán hợp lệ: 2 sữa chua (lô L-YOG-0926) + 1 nước cam (L-CAM-1026), tiền mặt + chuyển khoản ==='
SELECT id AS b_yog FROM batches WHERE "batchCode"='L-YOG-0926' \gset
SELECT id AS b_cam FROM batches WHERE "batchCode"='L-CAM-1026' \gset
SELECT id AS p_yog FROM products WHERE code='TH-YOGURT-ALOE' \gset
SELECT id AS p_cam FROM products WHERE code='TH-JUICE-ORANGE' \gset
SELECT id AS promo_tl FROM promotions WHERE code='GIAM20K' \gset
SELECT quantity AS yog_before FROM batches WHERE id=:'b_yog' \gset
SELECT "usedCount" AS used_before FROM promotions WHERE id=:'promo_tl' \gset
BEGIN;
INSERT INTO invoices (code,"cashierId",subtotal,"discountAmount","finalTotal",status,"paidAt")
VALUES ('HD-TEST-001', :'staff', 76000, 20000, 56000, 'completed', now()) RETURNING id AS inv \gset
INSERT INTO invoice_items ("invoiceId","productId","batchId",quantity,"unitPrice",discount)
VALUES (:'inv',:'p_yog',:'b_yog',2,28000,0) RETURNING id AS it1 \gset
INSERT INTO invoice_items ("invoiceId","productId","batchId",quantity,"unitPrice",discount)
VALUES (:'inv',:'p_cam',:'b_cam',1,20000,0);
INSERT INTO invoice_payments ("invoiceId",method,amount,"cashReceived",status,"confirmedById","confirmedAt")
VALUES (:'inv','cash',26000,50000,'confirmed',:'staff',now());
INSERT INTO invoice_payments ("invoiceId",method,amount,reference,status,"confirmedById","confirmedAt")
VALUES (:'inv','transfer',30000,'FT123','confirmed',:'staff',now());
INSERT INTO invoice_promotions ("invoiceId","promotionId","invoiceItemId","discountAmount") VALUES (:'inv',:'promo_tl',NULL,20000);
INSERT INTO stock_movements ("batchId",type,quantity,reason,"refType","refId","createdById")
VALUES (:'b_yog','sale',-2,'Bán hàng HD-TEST-001','invoice',:'inv',:'staff'),
       (:'b_cam','sale',-1,'Bán hàng HD-TEST-001','invoice',:'inv',:'staff');
UPDATE promotions SET "usedCount"="usedCount"+1 WHERE id=:'promo_tl' AND "usedCount" < "usageLimit";
COMMIT;
SELECT 'yogurt lô: '||:yog_before||' -> '||quantity AS "tồn sau bán" FROM batches WHERE id=:'b_yog';
SELECT 'GIAM20K usedCount: '||:used_before||' -> '||"usedCount" AS "lượt dùng" FROM promotions WHERE id=:'promo_tl';
SELECT subtotal AS "item.subtotal (cột sinh tự động)" FROM invoice_items WHERE id=:'it1';
SELECT count(*) AS mismatch_after FROM v_stock_mismatch;

\echo '=== (3) Thanh toán thiếu tiền: phải bị chặn lúc COMMIT ==='
BEGIN;
INSERT INTO invoices (code,"cashierId",subtotal,"discountAmount","finalTotal",status,"paidAt")
VALUES ('HD-TEST-002', :'staff', 50000, 0, 50000, 'completed', now()) RETURNING id AS inv2 \gset
INSERT INTO invoice_payments ("invoiceId",method,amount,status,"confirmedById","confirmedAt")
VALUES (:'inv2','cash',40000,'confirmed',:'staff',now());
COMMIT;
SELECT count(*) AS "HD-TEST-002 tồn tại (phải 0)" FROM invoices WHERE code='HD-TEST-002';

\echo '=== (4) Bán quá tồn: trigger phải chặn ==='
BEGIN;
INSERT INTO stock_movements ("batchId",type,quantity,reason,"refType","createdById")
VALUES (:'b_cam','sale',-100000,'oversell','invoice',:'staff');
ROLLBACK;

\echo '=== (5) Mã hết lượt: UPDATE có điều kiện trả 0 dòng ==='
UPDATE promotions SET "usageLimit"=:used_before+1 WHERE id=:'promo_tl';
UPDATE promotions SET "usedCount"="usedCount"+1 WHERE id=:'promo_tl' AND "usedCount" < "usageLimit";
\echo '--- (dòng trên: UPDATE 0 nghĩa là mã đã hết lượt, service sẽ báo lỗi và rollback)'

\echo '=== (6) Mã hóa đơn trùng: phải lỗi unique ==='
INSERT INTO invoices (code,"cashierId",subtotal,"discountAmount","finalTotal",status) VALUES ('HD-TEST-001', :'staff', 1,0,1,'draft');
