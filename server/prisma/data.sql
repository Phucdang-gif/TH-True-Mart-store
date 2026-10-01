-- data.sql
-- Script thêm dữ liệu mẫu cho bảng products (TH True Mart)

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
) VALUES 
(
  'TH-MILK-180', 
  'Sữa tươi tiệt trùng TH true MILK Dâu 180ml', 
  'SUA_TUOI_TIET_TRUNG', 
  'Lốc 4 hộp', 
  38000, 
  30000, 
  20, 
  'Sữa tươi tiệt trùng hương dâu hoàn toàn từ thiên nhiên',
  'server\public\uploads\products\TH-MILK-DAU-180ML.webp'
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
  'server\public\uploads\products\TH-FRESH-1L.webp'
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
  'server\public\uploads\products\TH-YOGURT-ALOE.webp'
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
  'server\public\uploads\products\TH-JUICE-ORANGE.webp'
),
(
  'TH-ICECREAM-SOCOLA', 
  'Kem que TH true ICE CREAM SOCOLA 52g',
  'KEM', 
  'Que', 
  25000, 
  18000, 
  15, 
  'Kem trà xanh tự nhiên mát lạnh',
  'server\public\uploads\products\TH-ICECREAM-SOCOLA.webp'
);