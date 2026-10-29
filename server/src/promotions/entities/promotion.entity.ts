import { BadRequestException } from '@nestjs/common';

export type PromotionScope = 'order' | 'category' | 'product' | 'near_expiry';
export type PromotionDiscountType = 'percentage' | 'fixed_amount';
export type PromotionStatus = 'scheduled' | 'active' | 'paused' | 'ended';

/**
 * Domain Entity: Promotion (Chương trình khuyến mãi & Mã giảm giá TH True Mart)
 * Quản lý vòng đời và điều kiện áp dụng khuyến mãi theo chuẩn Hướng đối tượng (OOAD).
 */
export class PromotionEntity {
  private _id: string;
  private _code: string;
  private _name: string;
  private _description?: string;
  private _scope: PromotionScope;
  private _discountType: PromotionDiscountType;
  private _value: number;
  private _maxDiscountAmount?: number | null;
  private _minOrderValue: number;
  private _categoryId?: string | null;
  private _nearExpiryDays?: number | null;
  private _productIds: string[];
  private _requiresCode: boolean;
  private _usageLimit?: number | null;
  private _usedCount: number;
  private _startDate: Date;
  private _endDate: Date;
  private _status: PromotionStatus;

  constructor(params: {
    id: string;
    code: string;
    name: string;
    description?: string;
    scope: PromotionScope;
    discountType: PromotionDiscountType;
    value: number;
    maxDiscountAmount?: number | null;
    minOrderValue?: number;
    categoryId?: string | null;
    nearExpiryDays?: number | null;
    productIds?: string[];
    requiresCode?: boolean;
    usageLimit?: number | null;
    usedCount?: number;
    startDate: Date | string;
    endDate: Date | string;
    status?: PromotionStatus;
  }) {
    if (!params.code) throw new BadRequestException('Mã khuyến mãi không được rỗng');
    if (!params.name) throw new BadRequestException('Tên chương trình không được rỗng');
    if (params.value <= 0) throw new BadRequestException('Giá trị giảm giá phải lớn hơn 0');

    this._id = params.id;
    this._code = params.code.trim().toUpperCase();
    this._name = params.name;
    this._description = params.description;
    this._scope = params.scope;
    this._discountType = params.discountType;
    this._value = params.value;
    this._maxDiscountAmount = params.maxDiscountAmount;
    this._minOrderValue = params.minOrderValue ?? 0;
    this._categoryId = params.categoryId;
    this._nearExpiryDays = params.nearExpiryDays;
    this._productIds = params.productIds ?? [];
    this._requiresCode = params.requiresCode ?? false;
    this._usageLimit = params.usageLimit;
    this._usedCount = params.usedCount ?? 0;
    this._startDate = new Date(params.startDate);
    this._endDate = new Date(params.endDate);
    this._status = params.status ?? 'active';

    if (this._endDate < this._startDate) {
      throw new BadRequestException('Thời gian kết thúc không được trước thời gian bắt đầu');
    }
  }

  public get id(): string { return this._id; }
  public get code(): string { return this._code; }
  public get name(): string { return this._name; }
  public get scope(): PromotionScope { return this._scope; }
  public get discountType(): PromotionDiscountType { return this._discountType; }
  public get value(): number { return this._value; }
  public get maxDiscountAmount(): number | null | undefined { return this._maxDiscountAmount; }
  public get minOrderValue(): number { return this._minOrderValue; }
  public get categoryId(): string | null | undefined { return this._categoryId; }
  public get nearExpiryDays(): number | null | undefined { return this._nearExpiryDays; }
  public get productIds(): readonly string[] { return this._productIds; }
  public get requiresCode(): boolean { return this._requiresCode; }
  public get usageLimit(): number | null | undefined { return this._usageLimit; }
  public get usedCount(): number { return this._usedCount; }
  public get startDate(): Date { return this._startDate; }
  public get endDate(): Date { return this._endDate; }
  public get status(): PromotionStatus { return this._status; }

  /**
   * Kiểm tra khuyến mãi có đang trong thời hạn hiệu lực không
   */
  public isTimeValid(now: Date = new Date()): boolean {
    return now >= this._startDate && now <= this._endDate;
  }

  /**
   * Kiểm tra khuyến mãi còn lượt sử dụng không
   */
  public hasAvailableUsage(): boolean {
    if (this._usageLimit == null) return true;
    return this._usedCount < this._usageLimit;
  }

  /**
   * Kiểm tra khuyến mãi có đủ điều kiện áp dụng hay không
   */
  public isApplicable(now: Date = new Date()): boolean {
    return this._status === 'active' && this.isTimeValid(now) && this.hasAvailableUsage();
  }

  /**
   * Tăng lượt sử dụng khi hóa đơn hoàn tất
   */
  public incrementUsage(): void {
    if (!this.hasAvailableUsage()) {
      throw new BadRequestException(`Chương trình ${this._code} đã hết lượt sử dụng`);
    }
    this._usedCount += 1;
    if (this._usageLimit && this._usedCount >= this._usageLimit) {
      this._status = 'ended';
    }
  }

  public activate(): void {
    this._status = 'active';
  }

  public pause(): void {
    this._status = 'paused';
  }

  public end(): void {
    this._status = 'ended';
  }
}
