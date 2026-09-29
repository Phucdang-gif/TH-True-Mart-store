-- data.sql
-- Script thêm dữ liệu mẫu cho bảng products (TH True Mart)

INSERT INTO "products" (
  "code", 
  "name", 
  "category", 
  "unit", 
  "sellingPrice", 
  "costPrice", 
  "barcode", 
  "minStockLevel", 
  "description"
) VALUES 
(
  'TH-MILK-180', 
  'Sữa tươi tiệt trùng TH true MILK Dâu 180ml', 
  'SUA_TUOI_TIET_TRUNG', 
  'Lốc 4 hộp', 
  38000, 
  30000, 
  '8936036012345', 
  20, 
  'Sữa tươi tiệt trùng hương dâu hoàn toàn từ thiên nhiên'
),
(
  'TH-FRESH-1L', 
  'Sữa tươi thanh trùng TH true MILK Ít đường 1L', 
  'SUA_TUOI_THANH_TRUNG', 
  'Hộp', 
  45000, 
  36000, 
  '8936036054321', 
  10, 
  'Sữa tươi thanh trùng giữ trọn vị ngon, bảo quản lạnh'
),
(
  'TH-YOGURT-ALOE', 
  'Sữa chua ăn TH true YOGURT Nha đam', 
  'SUA_CHUA', 
  'Lốc 4 hộp', 
  28000, 
  22000, 
  '8936036098765', 
  30, 
  'Sữa chua lên men tự nhiên kết hợp nha đam giòn'
),
(
  'TH-JUICE-ORANGE', 
  'Nước cam tự nhiên TH true JUICE 350ml', 
  'NUOC', 
  'Chai', 
  20000, 
  15000, 
  '8936036033333', 
  50, 
  'Nước trái cây ép lạnh, không thêm đường'
),
(
  'TH-ICECREAM-MATCHA', 
  'Kem que TH true ICE CREAM Trà xanh Matcha', 
  'KEM', 
  'Que', 
  25000, 
  18000, 
  '8936036077777', 
  15, 
  'Kem trà xanh tự nhiên mát lạnh'
);