import { Batch, Staff, Supplier, Promotion, Invoice, PurchaseOrder } from '../types';  

export const INITIAL_BATCHES: Batch[] = [
  {
    id: 'batch-01',
    batchCode: 'LOTH-2026-09A',
    productId: 'prod-01',
    manufacturingDate: '2026-08-01',
    expiryDate: '2026-10-05', // Expiring in ~14 days (Warning!)
    quantity: 48,
    importPrice: 31000,
    status: 'expiring_soon'
  },
  {
    id: 'batch-02',
    batchCode: 'LOTH-2026-09B',
    productId: 'prod-01',
    manufacturingDate: '2026-09-10',
    expiryDate: '2027-03-10',
    quantity: 120,
    importPrice: 31000,
    status: 'good'
  },
  {
    id: 'batch-03',
    batchCode: 'LOTH-2026-08K',
    productId: 'prod-03',
    manufacturingDate: '2026-09-15',
    expiryDate: '2026-09-28', // Short shelf-life (Pasteurized Milk ESL ~ 12-14 days - Expiring in 7 days!)
    quantity: 18,
    importPrice: 33000,
    status: 'expiring_soon'
  },
  {
    id: 'batch-04',
    batchCode: 'LOTH-2026-07Y',
    productId: 'prod-04',
    manufacturingDate: '2026-08-25',
    expiryDate: '2026-10-02', // Sữa chua ăn hạn 45 ngày (còn 11 ngày)
    quantity: 35,
    importPrice: 24500,
    status: 'expiring_soon'
  },
  {
    id: 'batch-05',
    batchCode: 'LOTH-2026-09C',
    productId: 'prod-02',
    manufacturingDate: '2026-09-01',
    expiryDate: '2027-03-01',
    quantity: 65,
    importPrice: 365000,
    status: 'good'
  },
  {
    id: 'batch-06',
    batchCode: 'LOTH-2026-09D',
    productId: 'prod-06',
    manufacturingDate: '2026-08-15',
    expiryDate: '2026-11-15',
    quantity: 40,
    importPrice: 62000,
    status: 'good'
  },
  {
    id: 'batch-07',
    batchCode: 'LOTH-2026-09E',
    productId: 'prod-08',
    manufacturingDate: '2026-08-01',
    expiryDate: '2027-08-01',
    quantity: 85,
    importPrice: 16000,
    status: 'good'
  },
  {
    id: 'batch-08',
    batchCode: 'LOTH-2026-09F',
    productId: 'prod-09',
    manufacturingDate: '2026-09-01',
    expiryDate: '2028-09-01',
    quantity: 240,
    importPrice: 3500,
    status: 'good'
  }
];

export const INITIAL_STAFF: Staff[] = [
  {
    id: 'staff-01',
    code: 'NV01',
    name: 'Đặng Hoàng Phúc',
    phone: '0978111222',
    email: 'danghoangphuc2006@gmail.com',
    username: 'admin',
    role: 'manager',
    status: 'active',
    shift: 'HANH_CHINH'
  },
  {
    id: 'staff-02',
    code: 'NV02',
    name: 'Vũ Thu Trang',
    phone: '0982333444',
    email: 'trang.vu@thtruemilk.vn',
    username: 'thutrang',
    role: 'manager',
    status: 'active',
    shift: 'SANG'
  },
  {
    id: 'staff-03',
    code: 'NV03',
    name: 'Nguyễn Văn Tuấn',
    phone: '0915666777',
    email: 'tuan.nv@thtruemart.vn',
    username: 'tuannv',
    role: 'cashier',
    status: 'active',
    shift: 'CHIEU'
  },
  {
    id: 'staff-04',
    code: 'NV04',
    name: 'Hoàng Quốc Bảo',
    phone: '0963888999',
    email: 'bao.hq@thtruemart.vn',
    username: 'baohq',
    role: 'warehouse',
    status: 'active',
    shift: 'SANG'
  }
];

export const INITIAL_PROMOTIONS: Promotion[] = [
  {
    id: 'promo-01',
    code: 'THSUMMER10',
    name: 'Mùa Hè Tươi Sạch Giảm 10% Sữa Chua',
    scope: 'category',
    discountType: 'percentage',
    value: 10,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    minOrderValue: 100000,
    applicableCategory: 'SUA_CHUA',
    requiresCode: false,
    usedCount: 0,
    status: 'active'
  },
  {
    id: 'promo-02',
    code: 'THVIP20K',
    name: 'Ưu đãi hóa đơn từ 200k giảm 20.000đ',
    scope: 'order',
    discountType: 'fixed_amount',
    value: 20000,
    startDate: '2026-09-15',
    endDate: '2026-10-15',
    minOrderValue: 200000,
    requiresCode: true,
    usedCount: 1,
    status: 'active'
  }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-01',
    code: 'NCC-TH-01',
    name: 'Công ty Cổ phần Thực phẩm Sữa TH (Trang trại TH Nghĩa Đàn)',
    contactPerson: 'Ông Lê Văn Thắng (Phòng Điều Vận)',
    phone: '0238 3888 999',
    email: 'dieuvankho@thfood.vn',
    address: 'Xã Nghĩa Sơn, Huyện Nghĩa Đàn, Tỉnh Nghệ An',
    categoryProvided: 'Sữa tươi, Bơ sữa, Kem, Nước tinh khiết',
    status: 'active'
  },
  {
    id: 'sup-02',
    code: 'NCC-TP-02',
    name: 'Công ty Cổ phần Tetra Pak Việt Nam',
    contactPerson: 'Bà Nguyễn Thị Hải',
    phone: '028 3825 8888',
    email: 'sales.vn@tetrapak.com',
    address: 'KCN VSIP II-A, Tân Uyên, Bình Dương',
    categoryProvided: 'Bao bì tiệt trùng 6 lớp thân thiện môi trường',
    status: 'active'
  },
  {
    id: 'sup-03',
    code: 'NCC-NAT-03',
    name: 'Công ty Nông sản Tự nhiên Núi Tiên',
    contactPerson: 'Nguyễn Văn An',
    phone: '0238 3777 555',
    email: 'nongsan@nuitien.vn',
    address: 'Thị xã Thái Hòa, Tỉnh Nghệ An',
    categoryProvided: 'Nha đam, Trái cây tự nhiên, Lá trà hữu cơ',
    status: 'active'
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-01',
    code: 'HD-20260921-001',
    createdAt: '2026-09-21 08:35:12',
    cashierId: 'staff-03',
    cashierName: 'Nguyễn Văn Tuấn',
    items: [
      {
        productId: 'prod-01',
        productCode: 'TH-MILK-001',
        productName: 'Sữa tươi tiệt trùng TH true MILK Ít đường 180ml',
        batchCode: 'LOTH-2026-09A',
        unit: 'Lốc 4 hộp',
        quantity: 2,
        unitPrice: 38000,
        discount: 1900,
        subtotal: 72200
      },
      {
        productId: 'prod-04',
        productCode: 'TH-YOGURT-001',
        productName: 'Sữa chua ăn TH true YOGURT Nha đam tự nhiên',
        batchCode: 'LOTH-2026-07Y',
        unit: 'Vỉ 4 hộp',
        quantity: 3,
        unitPrice: 32000,
        discount: 3200,
        subtotal: 86400
      }
    ],
    subtotal: 172000,
    discountAmount: 13400,
    finalTotal: 158600,
    paymentMethod: 'transfer',
    payments: [
      {
        id: 'pay-01',
        method: 'transfer',
        amount: 158600,
        status: 'confirmed',
        reference: 'VCB-FT26092108351',
        confirmedById: 'staff-03',
        confirmedAt: '2026-09-21 08:36:00'
      }
    ],
    receivedAmount: 158600,
    changeAmount: 0,
    paidAt: '2026-09-21 08:36:00',
    status: 'completed',
    notes: 'Khách hàng thanh toán qua VietQR Vietcombank'
  },
  {
    id: 'inv-02',
    code: 'HD-20260921-002',
    createdAt: '2026-09-21 09:12:40',
    cashierId: 'staff-03',
    cashierName: 'Nguyễn Văn Tuấn',
    items: [
      {
        productId: 'prod-02',
        productCode: 'TH-MILK-002',
        productName: 'Sữa tươi tiệt trùng TH true MILK Nguyên chất 180ml',
        batchCode: 'LOTH-2026-09C',
        unit: 'Thùng 48 hộp',
        quantity: 1,
        unitPrice: 435000,
        discount: 0,
        subtotal: 435000
      },
      {
        productId: 'prod-06',
        productCode: 'TH-CHEESE-001',
        productName: 'Phô mai tự nhiên TH true CHEESE Mozzarella 200g',
        batchCode: 'LOTH-2026-09D',
        unit: 'Gói 200g',
        quantity: 2,
        unitPrice: 78000,
        discount: 0,
        subtotal: 156000
      }
    ],
    subtotal: 591000,
    discountAmount: 20000,
    voucherCode: 'THVIP20K',
    finalTotal: 571000,
    paymentMethod: 'cash',
    payments: [
      {
        id: 'pay-02',
        method: 'cash',
        amount: 571000,
        status: 'confirmed',
        confirmedById: 'staff-03',
        confirmedAt: '2026-09-21 09:13:00'
      }
    ],
    receivedAmount: 600000,
    changeAmount: 29000,
    paidAt: '2026-09-21 09:13:00',
    status: 'completed'
  }
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'po-01',
    orderCode: 'PO-20260920-01',
    supplierId: 'sup-01',
    supplierName: 'Trang trại Bò sữa TH Nghĩa Đàn (Nghệ An)',
    createdAt: '2026-09-20 08:30:00',
    expectedDate: '2026-09-23',
    items: [
      {
        productId: 'prod-01',
        productName: 'Sữa tươi tiệt trùng TH true MILK Ít đường 180ml',
        quantity: 100,
        unitPrice: 31000,
        subtotal: 3100000
      },
      {
        productId: 'prod-03',
        productName: 'Sữa tươi thanh trùng TH true MILK Nguyên chất 900ml',
        quantity: 60,
        unitPrice: 34000,
        subtotal: 2040000
      }
    ],
    totalAmount: 5140000,
    status: 'pending',
    notes: 'Yêu cầu xe bảo ôn lạnh 2-4 độ C khi vận chuyển'
  },
  {
    id: 'po-02',
    orderCode: 'PO-20260918-02',
    supplierId: 'sup-03',
    supplierName: 'Công ty CP Nông sản Thực phẩm Núi Tiên',
    createdAt: '2026-09-18 14:15:00',
    expectedDate: '2026-09-22',
    items: [
      {
        productId: 'prod-07',
        productName: 'Kem que TH true ICE CREAM Sô cô la & Vani 60g',
        quantity: 80,
        unitPrice: 17500,
        subtotal: 1400000
      },
      {
        productId: 'prod-08',
        productName: 'Trà tự nhiên TH true TEA Ô Long 350ml',
        quantity: 120,
        unitPrice: 16000,
        subtotal: 1920000
      }
    ],
    totalAmount: 3320000,
    status: 'pending',
    notes: 'Bàn giao trực tiếp tại kho đông lạnh cửa hàng'
  }
];

