import React, { useState , useEffect} from 'react';
import { Navbar } from './components/Navbar';
import { BanHangPOS } from './components/pos/BanHangPOS';
import { QuanLyHangHoa } from './components/products/QuanLyHangHoa';
import { QuanLyKho } from './components/inventory/QuanLyKho';
import { QuanLyKhachHang } from './components/customers/QuanLyKhachHang';
import { QuanLyNhanVien } from './components/staff/QuanLyNhanVien';
import { QuanLyNhaCungCap } from './components/suppliers/QuanLyNhaCungCap';
import { BaoCaoThongKe } from './components/reports/BaoCaoThongKe';
import {  
  INITIAL_BATCHES, 
  INITIAL_CUSTOMERS, 
  INITIAL_STAFF, 
  INITIAL_SUPPLIERS, 
  INITIAL_PROMOTIONS, 
  INITIAL_INVOICES,
  INITIAL_PURCHASE_ORDERS 
} from './data/initialData';
import { Product, Batch, Customer, Staff, Supplier, Promotion, Invoice, PurchaseOrder } from './types';

export default function App() {
  const [activeModule, setActiveModule] = useState<number>(1); // 1 to 7

  // Application Data States
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/products');
        if (response.ok) {
          const data = await response.json();
          setProducts(data);
        }
      } catch (error) {
        console.error("Lỗi khi kết nối Database:", error);
      }
    };
    
    fetchProducts();
  }, []);
  const [batches, setBatches] = useState<Batch[]>(INITIAL_BATCHES);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [staffList, setStaffList] = useState<Staff[]>(INITIAL_STAFF);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [promotions, setPromotions] = useState<Promotion[]>(INITIAL_PROMOTIONS);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(INITIAL_PURCHASE_ORDERS);

  // Expiring Batches calculation for urgent badge in Navbar
  const getDaysLeft = (expiryDateStr: string) => {
    const today = new Date();
    const exp = new Date(expiryDateStr);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const expiringCount = batches.filter(b => {
    const days = getDaysLeft(b.expiryDate);
    return days <= 30 && b.quantity > 0;
  }).length;

  // Handlers
  // 1. Transaction handler: POS completed invoice -> deduct batch (FIFO) & add customer points
  const handleCreateInvoice = (newInvoice: Invoice) => {
    setInvoices(prev => [newInvoice, ...prev]);

    // FIFO inventory deduction
    setBatches(prevBatches => {
      const updated = [...prevBatches];
      newInvoice.items.forEach(cartItem => {
        let remainingToDeduct = cartItem.quantity;
        // find batches for this product sorted by expiryDate ascending (FIFO)
        const relevantBatches = updated
          .filter(b => b.productId === cartItem.productId && b.quantity > 0)
          .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

        for (const b of relevantBatches) {
          if (remainingToDeduct <= 0) break;
          if (b.quantity >= remainingToDeduct) {
            b.quantity -= remainingToDeduct;
            remainingToDeduct = 0;
          } else {
            remainingToDeduct -= b.quantity;
            b.quantity = 0;
          }
        }
      });
      return updated;
    });

    // Customer loyalty points update
    if (newInvoice.customerId) {
      setCustomers(prev => prev.map(c => {
        if (c.id === newInvoice.customerId) {
          const newPoints = c.points - newInvoice.pointsUsed + newInvoice.pointsEarned;
          const newTotalSpent = c.totalSpent + newInvoice.finalTotal;
          let tier = c.tier;
          if (newTotalSpent > 5000000) tier = 'Diamond';
          else if (newTotalSpent > 2500000) tier = 'Gold';
          else if (newTotalSpent > 1000000) tier = 'Silver';

          return {
            ...c,
            points: Math.max(0, newPoints),
            totalSpent: newTotalSpent,
            tier
          };
        }
        return c;
      }));
    }
  };

  const handleReturnInvoice = (invoiceId: string, reason: string) => {
    setInvoices(prev => prev.map(inv => 
      inv.id === invoiceId ? { ...inv, status: 'returned', notes: `${inv.notes || ''} [Đã trả hàng: ${reason}]` } : inv
    ));
  };

  const handleCancelInvoice = (invoiceId: string, reason: string) => {
    setInvoices(prev => prev.map(inv => 
      inv.id === invoiceId ? { ...inv, status: 'cancelled', notes: `${inv.notes || ''} [Đã hủy: ${reason}]` } : inv
    ));
  };

  // 2. Product management handlers
  const handleUpdateProductPrice = (productId: string, newSellingPrice: number, newCostPrice: number) => {
    setProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, sellingPrice: newSellingPrice, costPrice: newCostPrice } : p
    ));
  };

  const handleAddProduct = (newProd: Product) => {
    setProducts(prev => [...prev, newProd]);
  };

  const handleAddPromotion = (newPromo: Promotion) => {
    setPromotions(prev => [...prev, newPromo]);
  };

  // 3. Inventory handlers
  const handleAddBatch = (newBatch: Batch) => {
    setBatches(prev => [newBatch, ...prev]);
  };

  const handleAdjustStock = (batchId: string, newQuantity: number) => {
    setBatches(prev => prev.map(b => 
      b.id === batchId ? { ...b, quantity: newQuantity } : b
    ));
  };

  // 4. Customer handlers
  const handleAddCustomer = (newCustomer: Customer) => {
    setCustomers(prev => [...prev, newCustomer]);
  };

  const handleUpdateCustomerPoints = (customerId: string, deltaPoints: number) => {
    setCustomers(prev => prev.map(c => 
      c.id === customerId ? { ...c, points: Math.max(0, c.points + deltaPoints) } : c
    ));
  };

  // 5. Staff handlers
  const handleAddStaff = (newStaff: Staff) => {
    setStaffList(prev => [...prev, newStaff]);
  };

  const handleUpdateShift = (staffId: string, newShift: Staff['shift']) => {
    setStaffList(prev => prev.map(s => 
      s.id === staffId ? { ...s, shift: newShift } : s
    ));
  };

  // 6. Supplier handlers
  const handleAddSupplier = (newSup: Supplier) => {
    setSuppliers(prev => [...prev, newSup]);
  };

  const handleCreatePurchaseOrder = (newPO: PurchaseOrder) => {
    setPurchaseOrders(prev => [newPO, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Main Navigation Bar with 7 BFD modules */}
      <Navbar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        expiringCount={expiringCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        <div>
          {activeModule === 1 && (
            <BanHangPOS
              products={products}
              batches={batches}
              customers={customers}
              promotions={promotions}
              invoices={invoices}
              onCompleteSale={handleCreateInvoice}
              onReturnInvoice={handleReturnInvoice}
              onCancelInvoice={handleCancelInvoice}
            />
          )}

          {activeModule === 2 && (
            <QuanLyHangHoa
              products={products}
              promotions={promotions}
              onUpdateProductPrice={handleUpdateProductPrice}
              onAddProduct={handleAddProduct}
              onAddPromotion={handleAddPromotion}
            />
          )}

          {activeModule === 3 && (
            <QuanLyKho
              products={products}
              batches={batches}
              onAddBatch={handleAddBatch}
              onAdjustStock={handleAdjustStock}
            />
          )}

          {activeModule === 4 && (
            <QuanLyKhachHang
              customers={customers}
              invoices={invoices}
              onAddCustomer={handleAddCustomer}
              onUpdateCustomerPoints={handleUpdateCustomerPoints}
            />
          )}

          {activeModule === 5 && (
            <QuanLyNhanVien
              staffList={staffList}
              onAddStaff={handleAddStaff}
              onUpdateShift={handleUpdateShift}
            />
          )}

          {activeModule === 6 && (
            <QuanLyNhaCungCap
              suppliers={suppliers}
              products={products}
              purchaseOrders={purchaseOrders}
              onAddSupplier={handleAddSupplier}
              onCreatePurchaseOrder={handleCreatePurchaseOrder}
            />
          )}

          {activeModule === 7 && (
            <BaoCaoThongKe
              invoices={invoices}
              products={products}
              batches={batches}
            />
          )}
        </div>
      </main>
    </div>
  );
}
