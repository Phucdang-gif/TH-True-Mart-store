export type Category = 
  | 'Sữa tươi tiệt trùng'
  | 'Sữa tươi thanh trùng'
  | 'Sữa chua ăn & uống'
  | 'Bơ & Phô mai tự nhiên'
  | 'Kem TH true ICE CREAM'
  | 'Nước tinh khiết & Nước trái cây'
  | 'Trà tự nhiên TH true TEA';

export interface Batch {
  id: string;
  batchCode: string; // e.g. LOTH2026-09A
  productId: string;
  manufacturingDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  importPrice: number;
  status: 'good' | 'expiring_soon' | 'expired'; // expiring_soon <= 30 days
}

export interface Product {
  id: string;
  code: string; // e.g. TH001
  name: string;
  category: Category;
  unit: string; // Hộp 180ml, Thùng 48 hộp, Vỉ 4 hộp, Hũ 100g, Cây kem 70g, Chai 350ml
  sellingPrice: number;
  costPrice: number;
  barcode: string;
  minStockLevel: number;
  description: string;
  imageUrl?: string;
  status: 'active' | 'discontinued';
  discountPercent?: number;
}

export interface CartItem {
  product: Product;
  selectedBatch?: Batch;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface InvoiceItem {
  productId: string;
  productCode: string;
  productName: string;
  batchCode: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

export interface Invoice {
  id: string;
  code: string; // e.g. HD-20260921-001
  createdAt: string;
  cashierId: string;
  cashierName: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  voucherCode?: string;
  pointsUsed: number;
  pointsEarned: number;
  finalTotal: number;
  paymentMethod: 'cash' | 'transfer' | 'card';
  receivedAmount: number;
  changeAmount: number;
  status: 'completed' | 'returned' | 'cancelled';
  notes?: string;
}

export interface Customer {
  id: string;
  code: string; // e.g. KH001
  name: string;
  phone: string;
  email?: string;
  points: number;
  tier: 'Standard' | 'Silver' | 'Gold' | 'Diamond';
  createdAt: string;
  totalSpent: number;
}

export interface Staff {
  id: string;
  code: string; // e.g. NV001
  name: string;
  phone: string;
  email: string;
  username: string;
  role: 'admin' | 'manager' | 'cashier' | 'warehouse';
  status: 'active' | 'inactive';
  shift: 'Sáng (06:00 - 14:00)' | 'Chiều (14:00 - 22:00)' | 'Hành chính';
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  discountType: 'percentage' | 'fixed_amount';
  value: number;
  startDate: string;
  endDate: string;
  minOrderValue: number;
  applicableCategory?: string;
  status: 'active' | 'expired' | 'scheduled';
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  categoryProvided: string;
  status: 'active' | 'inactive';
}

export interface PurchaseOrder {
  id: string;
  orderCode: string;
  supplierId: string;
  supplierName: string;
  createdAt: string;
  expectedDate: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  totalAmount: number;
  status: 'pending' | 'received' | 'cancelled';
  notes?: string;
}

export interface StockAuditItem {
  productId: string;
  productName: string;
  systemQuantity: number;
  actualQuantity: number;
  difference: number;
  reason: string;
}
