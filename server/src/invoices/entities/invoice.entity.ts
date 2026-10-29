import { BadRequestException } from '@nestjs/common';
import { InvoiceItemEntity } from './invoice-item.entity';

export interface AppliedPromotionRecord {
  promotionId: string;
  code: string;
  name: string;
  lineIndex: number | null; // null = giảm cấp đơn
  discountAmount: number;
}

export type InvoiceStatus = 'draft' | 'paid' | 'cancelled';

/**
 * Domain Aggregate Root: Invoice (Hóa đơn bán hàng TH True Mart)
 * Quản lý toàn bộ thông tin bán hàng, danh sách mặt hàng trích từ lô,
 * chiết khấu khuyến mãi và tính toán tổng tiền thanh toán.
 */
export class InvoiceEntity {
  private _id?: string;
  private _invoiceCode: string;
  private _cashierId: string;
  private _items: InvoiceItemEntity[];
  private _appliedPromotions: AppliedPromotionRecord[];
  private _orderDiscount: number;
  private _status: InvoiceStatus;
  private _createdAt: Date;

  constructor(params: {
    id?: string;
    invoiceCode: string;
    cashierId: string;
    items?: InvoiceItemEntity[];
    appliedPromotions?: AppliedPromotionRecord[];
    orderDiscount?: number;
    status?: InvoiceStatus;
    createdAt?: Date | string;
  }) {
    if (!params.invoiceCode) throw new BadRequestException('Mã hóa đơn không được để trống');
    if (!params.cashierId) throw new BadRequestException('ID thu ngân không được để trống');

    this._id = params.id;
    this._invoiceCode = params.invoiceCode;
    this._cashierId = params.cashierId;
    this._items = params.items ?? [];
    this._appliedPromotions = params.appliedPromotions ?? [];
    this._orderDiscount = params.orderDiscount ?? 0;
    this._status = params.status ?? 'draft';
    this._createdAt = params.createdAt ? new Date(params.createdAt) : new Date();
  }

  public get id(): string | undefined {
    return this._id;
  }

  public get invoiceCode(): string {
    return this._invoiceCode;
  }

  public get cashierId(): string {
    return this._cashierId;
  }

  public get items(): readonly InvoiceItemEntity[] {
    return this._items;
  }

  public get appliedPromotions(): readonly AppliedPromotionRecord[] {
    return this._appliedPromotions;
  }

  public get orderDiscount(): number {
    return this._orderDiscount;
  }

  public get status(): InvoiceStatus {
    return this._status;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Thêm dòng sản phẩm vào hóa đơn
   */
  public addItem(item: InvoiceItemEntity): void {
    if (this._status !== 'draft') {
      throw new BadRequestException('Không thể thêm sản phẩm vào hóa đơn đã chốt hoặc đã hủy');
    }
    this._items.push(item);
  }

  /**
   * Tính tổng tiền tạm tính trước mọi giảm giá
   */
  public calculateSubtotal(): number {
    return this._items.reduce((sum, item) => sum + item.getSubtotal(), 0);
  }

  /**
   * Tổng giảm giá của tất cả các dòng
   */
  public getTotalLineDiscounts(): number {
    return this._items.reduce((sum, item) => sum + item.discountAmount, 0);
  }

  /**
   * Thiết lập giảm giá cấp đơn hàng
   */
  public setOrderDiscount(amount: number): void {
    if (amount < 0) throw new BadRequestException('Giảm giá đơn hàng không thể âm');
    const baseAfterLineDiscount = this.calculateSubtotal() - this.getTotalLineDiscounts();
    this._orderDiscount = Math.min(amount, Math.max(0, baseAfterLineDiscount));
  }

  /**
   * Ghi nhận khuyến mãi đã áp dụng
   */
  public recordAppliedPromotion(promo: AppliedPromotionRecord): void {
    this._appliedPromotions.push(promo);
  }

  public clearAppliedPromotions(): void {
    this._appliedPromotions = [];
    this._orderDiscount = 0;
  }

  /**
   * Tổng toàn bộ tiền giảm giá (cấp dòng + cấp đơn)
   */
  public calculateTotalDiscount(): number {
    return this.getTotalLineDiscounts() + this._orderDiscount;
  }

  /**
   * Tổng tiền thanh toán cuối cùng (Final Total)
   */
  public calculateFinalTotal(): number {
    return Math.max(0, this.calculateSubtotal() - this.calculateTotalDiscount());
  }

  /**
   * Hoàn tất thanh toán hóa đơn
   */
  public markAsPaid(): void {
    if (this._items.length === 0) {
      throw new BadRequestException('Hóa đơn không thể thanh toán khi không có sản phẩm');
    }
    if (this._status === 'paid') {
      throw new BadRequestException('Hóa đơn này đã được thanh toán trước đó');
    }
    this._status = 'paid';
  }

  /**
   * Hủy hóa đơn
   */
  public cancel(): void {
    if (this._status === 'paid') {
      throw new BadRequestException('Không thể hủy hóa đơn đã thanh toán');
    }
    this._status = 'cancelled';
  }

  public toJSON() {
    return {
      id: this._id,
      invoiceCode: this._invoiceCode,
      cashierId: this._cashierId,
      status: this._status,
      subtotal: this.calculateSubtotal(),
      lineDiscounts: this.getTotalLineDiscounts(),
      orderDiscount: this._orderDiscount,
      totalDiscount: this.calculateTotalDiscount(),
      finalTotal: this.calculateFinalTotal(),
      items: this._items.map((i) => i.toJSON()),
      appliedPromotions: this._appliedPromotions,
      createdAt: this._createdAt.toISOString(),
    };
  }
}
