import { BadRequestException } from '@nestjs/common';

export type ProductStatus = 'active' | 'inactive' | 'discontinued';

/**
 * Domain Entity: Product (Sản phẩm TH True Mart)
 * Đóng gói dữ liệu định danh, giá bán, giá vốn và trạng thái kinh doanh của sản phẩm.
 */
export class ProductEntity {
  private _id: string;
  private _code: string;
  private _name: string;
  private _categoryId: string;
  private _unit: string;
  private _sellingPrice: number;
  private _costPrice: number;
  private _minStockLevel: number;
  private _description?: string;
  private _status: ProductStatus;

  constructor(params: {
    id: string;
    code: string;
    name: string;
    categoryId: string;
    unit: string;
    sellingPrice: number;
    costPrice: number;
    minStockLevel?: number;
    description?: string;
    status?: ProductStatus;
  }) {
    if (!params.id) throw new BadRequestException('ID sản phẩm không được để trống');
    if (!params.code) throw new BadRequestException('Mã sản phẩm không được để trống');
    if (!params.name) throw new BadRequestException('Tên sản phẩm không được để trống');
    if (params.sellingPrice < 0) throw new BadRequestException('Giá bán không được nhỏ hơn 0');
    if (params.costPrice < 0) throw new BadRequestException('Giá vốn không được nhỏ hơn 0');

    this._id = params.id;
    this._code = params.code;
    this._name = params.name;
    this._categoryId = params.categoryId;
    this._unit = params.unit;
    this._sellingPrice = params.sellingPrice;
    this._costPrice = params.costPrice;
    this._minStockLevel = params.minStockLevel ?? 0;
    this._description = params.description;
    this._status = params.status ?? 'active';
  }

  public get id(): string {
    return this._id;
  }

  public get code(): string {
    return this._code;
  }

  public get name(): string {
    return this._name;
  }

  public get categoryId(): string {
    return this._categoryId;
  }

  public get unit(): string {
    return this._unit;
  }

  public get sellingPrice(): number {
    return this._sellingPrice;
  }

  public get costPrice(): number {
    return this._costPrice;
  }

  public get minStockLevel(): number {
    return this._minStockLevel;
  }

  public get description(): string | undefined {
    return this._description;
  }

  public get status(): ProductStatus {
    return this._status;
  }

  public isActive(): boolean {
    return this._status === 'active';
  }

  /**
   * Nghiệp vụ: Cập nhật giá bán và giá vốn sản phẩm (UC12)
   */
  public updatePrice(newSellingPrice: number, newCostPrice?: number): void {
    if (newSellingPrice <= 0) {
      throw new BadRequestException('Giá bán mới phải lớn hơn 0');
    }
    this._sellingPrice = newSellingPrice;
    if (newCostPrice !== undefined) {
      if (newCostPrice < 0) throw new BadRequestException('Giá vốn không thể âm');
      this._costPrice = newCostPrice;
    }
  }

  /**
   * Nghiệp vụ: Ngừng kinh doanh sản phẩm
   */
  public deactivate(): void {
    this._status = 'inactive';
  }

  public activate(): void {
    this._status = 'active';
  }

  /**
   * Nghiệp vụ: Kiểm tra cảnh báo tồn kho tối thiểu
   */
  public isLowStock(currentTotalStock: number): boolean {
    return currentTotalStock <= this._minStockLevel;
  }

  public toJSON() {
    return {
      id: this._id,
      code: this._code,
      name: this._name,
      categoryId: this._categoryId,
      unit: this._unit,
      sellingPrice: this._sellingPrice,
      costPrice: this._costPrice,
      minStockLevel: this._minStockLevel,
      description: this._description,
      status: this._status,
      isActive: this.isActive(),
    };
  }
}
