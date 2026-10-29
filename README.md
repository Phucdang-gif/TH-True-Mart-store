# 🥛 Hệ Thống Quản Lý Cửa Hàng TH True Mart (TH True Mart Store Management System)

> **Đồ án môn học:** Phân tích & Thiết kế Hướng đối tượng (Object-Oriented Analysis and Design - OOAD)  
> **Đề tài:** Xây dựng Hệ thống Quản lý Cửa hàng Bán lẻ Chuỗi TH True Mart  
> **Nhóm thực hiện:** Nhóm 24  
> **Trưởng nhóm:** Đặng Hoàng Phúc (MSSV: `3124410280`)  
> **Giảng viên hướng dẫn:** Cô Phan Nguyệt Minh  

---

![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Build-Vite%208-646CFF?logo=vite&logoColor=white)
![NestJS](https://img.shields.io/badge/Backend-NestJS%2010-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/Language-TypeScript%205-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/ORM-Prisma%206-2D3748?logo=prisma&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?logo=tailwind-css&logoColor=white)

---

## 📖 1. Giới thiệu Đề tài

Hệ thống Quản lý Cửa hàng TH True Mart là phần mềm chuyên biệt phục vụ công tác vận hành bán lẻ chuỗi cửa hàng thực phẩm, sữa tươi sạch TH True Mart. Hệ thống giải quyết các bài toán đặc thù của ngành hàng thực phẩm tươi sống có **hạn sử dụng ngắn**, yêu cầu nghiêm ngặt về quản lý chất lượng theo nguyên tắc **FIFO (First In First Out)**, quản lý đa lô hàng, chính sách khuyến mãi phức tạp và đối soát sổ cái biến động kho.

Dự án được xây dựng tuân thủ chặt chẽ theo các nguyên lý **Thiết kế Hướng đối tượng (OOP/SOLID)**, ứng dụng **Clean Architecture**, **Domain-Driven Design (Rich Domain Model)** và các **Design Patterns kinh điển** (Strategy Pattern, Factory Pattern, Repository Pattern).

---

## ✨ 2. Các Phân hệ Chức năng Chính (6 Modules / 28 Use Cases)

Hệ thống bao phủ trọn vẹn chu trình chuỗi cung ứng bán lẻ (Retail Supply Chain Cycle):

```
[ Nhà cung cấp ] ──> [ Đơn đặt hàng PO ] ──> [ Nhập kho sinh Lô ]
                                                     │
                                                     ▼
[ Báo cáo doanh thu ] <── [ Hóa đơn POS ] <── [ Xuất kho FIFO ]
```

### 🛒 2.1. Phân hệ Bán hàng tại quầy (POS & Cashier)
* **Bán hàng theo nguyên tắc FIFO tự động:** Hệ thống tự động truy vấn và trừ kho từ các lô hàng (`batches`) có hạn sử dụng gần nhất trước, giảm thiểu tối đa rủi ro tồn kho cận date.
* **Cơ chế an toàn thực phẩm TH:**
  * Chặn tuyệt đối việc bán các lô hàng đã hết hạn sử dụng (`expired`).
  * Tự động gắn nhãn cảnh báo lô hàng sắp hết hạn (`expiring_soon` $\le$ 30 ngày).
* **Động cơ Khuyến mãi tự động (Promotion Engine):** Tự động áp dụng khuyến mãi tốt nhất (Best-of), kiểm tra trần giảm giá tối đa (Discount Cap), giá trị đơn hàng tối thiểu (Min Order Value), làm tròn tiền chuẩn VNĐ.
* **Đa dạng hình thức thanh toán:** Tiền mặt (tự động tính tiền thừa), Thẻ ngân hàng, Chuyển khoản qua mã QR động (VietQR).
* **Xem & In hóa đơn:** Hỗ trợ xem trước và in hóa đơn bán hàng tiêu chuẩn.

### 🏷️ 2.2. Phân hệ Quản lý Hàng hóa & Danh mục (Catalog Management)
* **CRUD Sản phẩm toàn diện:** Quản lý mã sản phẩm, tên, đơn vị tính, giá vốn, giá bán, định mức tồn kho tối thiểu, mô tả và ảnh bao bì sản phẩm.
* **Quản lý Danh mục động (Categories API):** Danh mục sản phẩm được quản lý động 100% trong CSDL PostgreSQL qua API `/api/categories`, cho phép thêm mới, sửa, xóa danh mục mà không phải định nghĩa cứng ở Frontend.
* **Lịch sử biến động giá (`price_history`):** Mọi thao tác đổi giá bán sản phẩm đều được ghi vết lịch sử kèm thông tin nhân viên thực hiện và mốc thời gian, đảm bảo tính toàn vẹn cho các hóa đơn cũ.
* **Quản lý chương trình Khuyến mãi:** Thiết lập 4 phạm vi áp dụng (Cả hóa đơn, Nhóm hàng, Sản phẩm chỉ định, Lô cận date xả hàng); điều khiển trạng thái (Draft, Scheduled, Active, Paused, Expired).

### 📦 2.3. Phân hệ Quản lý Kho & Lô hàng (Inventory & Multi-tier Ledger)
* **Kiến trúc kho 3 tầng chống lệch số lượng:**
  $$\text{Products (Sản phẩm tổng)} \longrightarrow \text{Batches (Lô hàng/HSD)} \longrightarrow \text{Stock Movements (Sổ cái xuất nhập tồn)}$$
* **Nhập kho tự động (Inbound):** Tiếp nhận đơn hàng nhà cung cấp và tự động sinh lô hàng mới với Ngày sản xuất và Hạn sử dụng tương ứng.
* **Xuất kho & Điều chỉnh kho:** Ghi sổ biến động kho theo mô hình Ledger, không bao giờ sửa đè số lượng thô.
* **Quy trình Kiểm kê đối soát (`stock_audits`):** Ghi nhận chênh lệch giữa số lượng thực tế và phần mềm, phân loại nguyên nhân hao hụt (Hỏng, Hết hạn, Thất thoát), quy trình Quản lý phê duyệt (Approval) để tự động cân bằng kho và phát sinh giao dịch điều chỉnh.

### 🚚 2.4. Phân hệ Nhà cung cấp & Mua hàng (Purchasing & Suppliers)
* Quản lý thông tin nhà cung cấp (Mã, tên, người liên hệ, số điện thoại, địa chỉ, nhóm hàng cung cấp).
* Lập và quản lý vòng đời Đơn đặt hàng (Purchase Orders - PO): Chờ nhận hàng $\rightarrow$ Đã nhập kho $\rightarrow$ Đã hủy.

### 👥 2.5. Phân hệ Nhân viên & Phân quyền Bảo mật (Staff & Security RBAC)
* **Phân quyền truy cập theo vai trò (RBAC):** Quản lý cửa hàng (Manager), Thu ngân (Cashier), Thủ kho (Warehouse).
* **Bảo mật xác thực:** Đăng nhập bảo mật với JSON Web Token (JWT) và thuật toán băm mật khẩu `bcrypt`.
* **Cơ chế chống brute-force:** Tự động khóa tài khoản khi nhập sai mật khẩu quá 5 lần liên tiếp.
* **Nhật ký truy cập hệ thống (`login_logs`):** Ghi vết địa chỉ IP, User Agent, mốc thời gian và trạng thái đăng nhập.

### 📊 2.6. Phân hệ Báo cáo & Thống kê kinh doanh (Reports & Analytics)
* Thống kê doanh thu, lợi nhuận gộp, tiền chiết khấu khuyến mãi theo Ngày / Tháng / Năm từ dữ liệu hóa đơn thực tế.
* Thống kê các mặt hàng bán chạy nhất (Top Sellers).
* Thống kê định giá vốn tồn kho theo từng lô hàng hiện có.
* Đánh giá hiệu quả các chương trình khuyến mãi.

---

## 🏛️ 3. Điểm Sáng Kiến Trúc & Thiết Kế Hướng Đối Tượng (OOAD Highlights)

1. **Rich Domain Model (Domain-Driven Design):**
   - Các Entity tại `server/src/*/entities/*.entity.ts` (`BatchEntity`, `InvoiceEntity`, `InvoiceItemEntity`, `StockAuditEntity`, `ProductEntity`, `PromotionEntity`) đóng gói toàn bộ logic nghiệp vụ (Encapsulation), không sử dụng Anemic Data Model.
2. **Strategy Pattern trong Động cơ Khuyến mãi:**
   - Interface `IDiscountStrategy` được triển khai qua các lớp: `OrderDiscountStrategy`, `CategoryDiscountStrategy`, `ProductDiscountStrategy`, `NearExpiryDiscountStrategy`.
   - Lớp `PromotionStrategyFactory` chịu trách nhiệm tạo chiến lược tương ứng, tuân thủ nguyên lý **Open/Closed Principle (OCP)** của SOLID.
3. **Mô hình Sổ cái (Ledger-based Inventory):**
   - Số lượng hàng hóa được bảo vệ toàn vẹn: Mọi hành động Bán hàng (sale), Nhập kho (import), Xuất hủy (export), Kiểm kê (audit) đều ghi nhận một bản ghi trong `stock_movements`, đảm bảo có thể kiểm toán và truy vết lịch sử 100%.

---

## 🛠️ 4. Công Nghệ Sử Dụng (Tech Stack)

| Tầng | Công nghệ | Chi tiết |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8 | Single Page Application, Tailwind CSS, Lucide Icons, Fetch API Client |
| **Backend** | NestJS 10, Node.js | TypeScript, RESTful API, Validation Pipe (`class-validator`), JWT Auth |
| **Database** | PostgreSQL 16, Prisma ORM 6 | Cơ sở dữ liệu quan hệ, quan hệ kho đa tầng, triggers & indexes |
| **Kiểm thử** | ts-node | Bộ unit test kiểm thử tự động thuật toán định giá và khuyến mãi |

---

## 📂 5. Cấu Trúc Thư Mục Dự Án

```
TH-True-Mart-store/
├── frontend/                     # Ứng dụng React + Vite Frontend
│   ├── public/uploads/products/  # Ảnh bao bì sản phẩm phục vụ tĩnh
│   ├── src/
│   │   ├── components/           # Các màn hình phân hệ (POS, Kho, Hàng hóa, Nhân viên, NCC, Báo cáo)
│   │   ├── hooks/                # React Custom Hooks kết nối API
│   │   ├── services/             # Lớp Service gọi HTTP client
│   │   ├── types/                # Hợp đồng dữ liệu TypeScript Interfaces
│   │   ├── lib/                  # Utilities, API client, nhãn hệ thống
│   │   └── App.tsx               # Cấu hình Module Navigation & Gatekeeper Auth
│   └── package.json
│
├── server/                       # Ứng dụng NestJS Backend
│   ├── prisma/
│   │   ├── schema.prisma         # Lược đồ quan hệ CSDL PostgreSQL
│   │   ├── init.sql              # Script khởi tạo bảng và Enums
│   │   └── data.sql              # Dữ liệu mẫu TH True Mart
│   ├── src/
│   │   ├── auth/                 # Xác thực JWT, đăng nhập, khóa tài khoản
│   │   ├── batches/              # Quản lý Lô hàng & Date
│   │   ├── categories/           # CRUD Danh mục sản phẩm động
│   │   ├── goods-receipts/       # Nhập kho & sinh lô tự động
│   │   ├── invoices/             # Hóa đơn POS & tính giá
│   │   ├── products/             # Quản lý Sản phẩm & Lịch sử giá
│   │   ├── promotions/           # Động cơ Khuyến mãi (Strategy Pattern)
│   │   ├── purchase-orders/      # Đơn đặt hàng nhà cung cấp
│   │   ├── roles/                # Phân quyền RBAC & Nhóm quyền
│   │   ├── staff/                # Quản lý Nhân sự & Nhật ký đăng nhập
│   │   ├── stock-audits/         # Kiểm kê kho & Phê duyệt Quản lý
│   │   ├── stock-movements/      # Sổ cái biến động kho
│   │   ├── suppliers/            # Quản lý Nhà cung cấp
│   │   └── main.ts               # Khởi tạo server, CORS, Static Assets
│   ├── test/
│   │   └── pricing.check.ts      # Unit tests định giá & khuyến mãi
│   └── package.json
│
└── README.md
```

---

## 🚀 6. Hướng Dẫn Cài Đặt & Chạy Dự Án (Getting Started)

### Yêu cầu hệ thống:
* **Node.js:** phiên bản `18.x` hoặc `20.x` trở lên
* **PostgreSQL:** phiên bản `14.x` trở lên (chạy tại port mặc định `5432`)
* **Git**

---

### Bước 1: Clone mã nguồn
```bash
git clone https://github.com/Phucdang-gif/TH-True-Mart-store.git
cd TH-True-Mart-store
```

### Bước 2: Cài đặt và Cấu hình Backend Server
1. Cài đặt các thư viện:
   ```bash
   cd server
   npm install
   ```

2. Tạo file cấu hình môi trường `.env` trong thư mục `server/`:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/th_true_mart?schema=public"
   PORT=3001
   JWT_SECRET="th_true_mart_super_secret_jwt_key_2026"
   ```
   *(Thay thế `postgres:password` bằng thông tin tài khoản PostgreSQL trên máy của bạn).*

3. Đồng bộ lược đồ CSDL và khởi tạo dữ liệu:
   ```bash
   # Tạo database và sinh Prisma Client
   npx prisma db push
   
   # (Tùy chọn) Chạy script init.sql và data.sql trong thư mục server/prisma vào PostgreSQL
   ```

4. Khởi chạy Backend NestJS:
   ```bash
   npm run start:dev
   ```
   Server sẽ lắng nghe tại: `http://localhost:3001`

---

### Bước 3: Cài đặt và Cấu hình Frontend
Mở một cửa sổ Terminal mới:
```bash
cd frontend
npm install
npm run dev
```
Giao diện người dùng sẽ chạy tại: `http://localhost:5173`

---

## 🔑 7. Tài Khoản Demo Đăng Nhập Mặc Định

Hệ thống đã chuẩn bị sẵn tài khoản cho từng vai trò để phục vụ việc kiểm thử phân quyền:

| Vai trò | Tên đăng nhập | Mật khẩu mặc định | Quyền hạn truy cập |
| :--- | :--- | :--- | :--- |
| **Quản lý (Manager)** | `admin` hoặc `thutrang` | `TH@12345` | Toàn quyền truy cập cả 6 phân hệ (Bán hàng, Hàng hóa, Kho, Nhân viên, NCC, Báo cáo). |
| **Thu ngân (Cashier)** | `tuannv` | `TH@12345` | Bán hàng POS, xem danh mục hàng hóa, lập hóa đơn thanh toán. |
| **Thủ kho (Warehouse)** | `baohq` | `TH@12345` | Quản lý kho, nhập kho từ PO, tạo phiếu kiểm kê, xuất/điều chỉnh kho. |

---

## 🧪 8. Chạy Kiểm Thử Động Cơ Tính Giá & Khuyến Mãi (Unit Tests)

Dự án có bộ kiểm thử tự động 15 trường hợp biên phức tạp cho Động cơ tính giá & Khuyến mãi (Strategy Pattern, Best-of, Cap, Cận Date, Min Order...):

```bash
cd server
node node_modules/ts-node/dist/bin.js test/pricing.check.ts
```

**Kết quả kiểm thử kỳ vọng:**
```
OK   không KM 
OK   auto 5% đơn 200k 
OK   voucher 20k thắng auto 
OK   voucher không tự áp 
OK   dưới min order 
OK   cap cấp đơn 
OK   dòng + đơn 
OK   R1 best-of cận date 
OK   cận date theo từng lô 
OK   days<0 không giảm 
OK   cap chia tỷ lệ 
OK   R5 fixed cấp dòng bỏ qua 
OK   không vượt tạm tính 
OK   làm tròn xuống 
OK   R7 hòa ưu tiên mã nhập 

TẤT CẢ ĐẠT
```

---

## 👥 9. Thông Tin Thành Viên Nhóm 24

* **Đặng Hoàng Phúc (Trưởng nhóm)** - MSSV: `3124410280`
* **Môn học:** Phân tích thiết kế hướng đối tượng (OOAD)
* **Giảng viên hướng dẫn:** ThS. Phan Nguyệt Minh
