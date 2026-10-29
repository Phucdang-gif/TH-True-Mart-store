import { BadRequestException } from '@nestjs/common';

/**
 * Domain Entity: Batch (Lô hàng)
 * Đại diện cho một lô sản phẩm có hạn sử dụng và số lượng trong kho TH True Mart.
 * Tuân thủ nguyên lý Đóng gói (Encapsulation) của Hướng đối tượng (OOAD).
 */
export class BatchEntity {
  private _id: string;
  private _productId: string;
  private _batchCode: string;
  private _manufacturingDate: Date;
  private _expiryDate: Date;
  private _quantity: number;
  private _importPrice?: number;

  constructor(params: {
    id: string;
    productId: string;
    batchCode: string;
    manufacturingDate: Date | string;
    expiryDate: Date | string;
    quantity: number;
    importPrice?: number;
  }) {
    if (!params.id) throw new BadRequestException('ID lô hàng không được rỗng');
    if (!params.batchCode) throw new BadRequestException('Mã lô hàng không được rỗng');
    if (params.quantity < 0) throw new BadRequestException('Số lượng tồn kho lô hàng không được âm');

    this._id = params.id;
    this._productId = params.productId;
    this._batchCode = params.batchCode;
    this._manufacturingDate = new Date(params.manufacturingDate);
    this._expiryDate = new Date(params.expiryDate);
    this._quantity = params.quantity;
    this._importPrice = params.importPrice;

    if (this._expiryDate < this._manufacturingDate) {
      throw new BadRequestException('Hạn sử dụng không thể trước ngày sản xuất');
    }
  }

  public get id(): string {
    return this._id;
  }

  public get productId(): string {
    return this._productId;
  }

  public get batchCode(): string {
    return this._batchCode;
  }

  public get manufacturingDate(): Date {
    return this._manufacturingDate;
  }

  public get expiryDate(): Date {
    return this._expiryDate;
  }

  public get quantity(): number {
    return this._quantity;
  }

  public get importPrice(): number | undefined {
    return this._importPrice;
  }

  /**
   * Nghiệp vụ: Kiểm tra lô hàng đã hết hạn sử dụng chưa
   */
  public isExpired(referenceDate: Date = new Date()): boolean {
    return this._expiryDate.getTime() < referenceDate.getTime();
  }

  /**
   * Nghiệp vụ: Tính số ngày còn lại đến ngày hết hạn (làm tròn lên)
   */
  public getDaysToExpiry(referenceDate: Date = new Date()): number {
    const diffMs = this._expiryDate.getTime() - referenceDate.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Nghiệp vụ: Kiểm tra lô hàng có thuộc diện cận date cần xả hàng/cảnh báo không
   */
  public isExpiringSoon(thresholdDays: number = 30, referenceDate: Date = new Date()): boolean {
    const days = this.getDaysToExpiry(referenceDate);
    return days >= 0 && days <= thresholdDays && this._quantity > 0;
  }

  /**
   * Nghiệp vụ: Trừ số lượng tồn của lô hàng khi xuất kho hoặc bán hàng.
   * Đảm bảo tính toàn vẹn trạng thái của đối tượng (Encapsulation).
   */
  public deductQuantity(qty: number): void {
    if (qty <= 0) {
      throw new BadRequestException(`Số lượng trừ phải lớn hơn 0 (nhận được: ${qty})`);
    }
    if (qty > this._quantity) {
      throw new BadRequestException(
        `Không đủ tồn kho trong lô ${this._batchCode}. Tồn hiện tại: ${this._quantity}, yêu cầu: ${qty}`,
      );
    }
    this._quantity -= qty;
  }

  /**
   * Nghiệp vụ: Bổ sung số lượng tồn của lô hàng khi nhập kho hoặc điều chỉnh tăng.
   */
  public addQuantity(qty: number): void {
    if (qty <= 0) {
      throw new BadRequestException(`Số lượng cộng phải lớn hơn 0 (nhận được: ${qty})`);
    }
    this._quantity += qty;
  }

  /**
   * Xuất đối tượng ra plain object để serialize hoặc lưu CSDL
   */
  public toJSON() {
    return {
      id: this._id,
      productId: this._productId,
      batchCode: this._batchCode,
      manufacturingDate: this._manufacturingDate.toISOString(),
      expiryDate: this._expiryDate.toISOString(),
      quantity: this._quantity,
      importPrice: this._importPrice,
      daysToExpiry: this.getDaysToExpiry(),
      isExpired: this.isExpired(),
      isExpiringSoon: this.isExpiringSoon(),
    };
  }
}
