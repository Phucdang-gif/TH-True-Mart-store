import { BadRequestException } from '@nestjs/common';

/**
 * Domain Entity: InvoiceItem (Chi tiết dòng hóa đơn)
 * Biểu diễn việc bán một số lượng sản phẩm được trích xuất từ một Lô hàng (Batch) cụ thể.
 */
export class InvoiceItemEntity {
  private _productId: string;
  private _productCode: string;
  private _productName: string;
  private _unit: string;
  private _batchId: string;
  private _batchCode: string;
  private _expiryDate: Date;
  private _quantity: number;
  private _unitPrice: number;
  private _discountAmount: number;

  constructor(params: {
    productId: string;
    productCode: string;
    productName: string;
    unit: string;
    batchId: string;
    batchCode: string;
    expiryDate: Date | string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
  }) {
    if (params.quantity <= 0) {
      throw new BadRequestException('Số lượng sản phẩm trong dòng hóa đơn phải lớn hơn 0');
    }
    if (params.unitPrice < 0) {
      throw new BadRequestException('Đơn giá không thể âm');
    }

    this._productId = params.productId;
    this._productCode = params.productCode;
    this._productName = params.productName;
    this._unit = params.unit;
    this._batchId = params.batchId;
    this._batchCode = params.batchCode;
    this._expiryDate = new Date(params.expiryDate);
    this._quantity = params.quantity;
    this._unitPrice = params.unitPrice;
    this._discountAmount = params.discountAmount ?? 0;
  }

  public get productId(): string {
    return this._productId;
  }

  public get productCode(): string {
    return this._productCode;
  }

  public get productName(): string {
    return this._productName;
  }

  public get unit(): string {
    return this._unit;
  }

  public get batchId(): string {
    return this._batchId;
  }

  public get batchCode(): string {
    return this._batchCode;
  }

  public get expiryDate(): Date {
    return this._expiryDate;
  }

  public get quantity(): number {
    return this._quantity;
  }

  public get unitPrice(): number {
    return this._unitPrice;
  }

  public get discountAmount(): number {
    return this._discountAmount;
  }

  /**
   * Tính thành tiền trước giảm giá của dòng
   */
  public getSubtotal(): number {
    return this._quantity * this._unitPrice;
  }

  /**
   * Áp dụng chiết khấu cấp dòng (theo sản phẩm, ngành hàng hoặc cận date)
   */
  public applyDiscount(amount: number): void {
    if (amount < 0) throw new BadRequestException('Số tiền chiết khấu không thể âm');
    const subtotal = this.getSubtotal();
    this._discountAmount = Math.min(amount, subtotal);
  }

  /**
   * Thành tiền sau chiết khấu của dòng
   */
  public getFinalTotal(): number {
    return Math.max(0, this.getSubtotal() - this._discountAmount);
  }

  public toJSON() {
    return {
      productId: this._productId,
      productCode: this._productCode,
      productName: this._productName,
      unit: this._unit,
      batchId: this._batchId,
      batchCode: this._batchCode,
      expiryDate: this._expiryDate.toISOString(),
      quantity: this._quantity,
      unitPrice: this._unitPrice,
      subtotal: this.getSubtotal(),
      discountAmount: this._discountAmount,
      finalTotal: this.getFinalTotal(),
    };
  }
}
