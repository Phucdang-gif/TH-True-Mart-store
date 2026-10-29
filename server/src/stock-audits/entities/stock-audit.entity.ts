import { BadRequestException } from '@nestjs/common';

export type StockAuditStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export class StockAuditItemEntity {
  constructor(
    public readonly batchId: string,
    public readonly systemQuantity: number,
    public actualQuantity: number,
    public reason?: string,
  ) {
    if (systemQuantity < 0) throw new BadRequestException('Số lượng hệ thống không thể âm');
    if (actualQuantity < 0) throw new BadRequestException('Số lượng thực tế không thể âm');
  }

  public get difference(): number {
    return this.actualQuantity - this.systemQuantity;
  }
}

/**
 * Domain Aggregate Root: StockAudit (Phiếu kiểm kê kho TH True Mart)
 * Quản lý quy trình kiểm đếm tồn kho thực tế, đối chiếu chênh lệch
 * và quy trình phê duyệt của Quản lý cửa hàng (UC18, UC19).
 */
export class StockAuditEntity {
  private _id: string;
  private _auditCode: string;
  private _auditDate: Date;
  private _performedById: string;
  private _approvedById?: string | null;
  private _status: StockAuditStatus;
  private _items: StockAuditItemEntity[];

  constructor(params: {
    id: string;
    auditCode: string;
    auditDate?: Date | string;
    performedById: string;
    approvedById?: string | null;
    status?: StockAuditStatus;
    items?: StockAuditItemEntity[];
  }) {
    this._id = params.id;
    this._auditCode = params.auditCode;
    this._auditDate = params.auditDate ? new Date(params.auditDate) : new Date();
    this._performedById = params.performedById;
    this._approvedById = params.approvedById;
    this._status = params.status ?? 'draft';
    this._items = params.items ?? [];
  }

  public get id(): string { return this._id; }
  public get auditCode(): string { return this._auditCode; }
  public get auditDate(): Date { return this._auditDate; }
  public get performedById(): string { return this._performedById; }
  public get approvedById(): string | null | undefined { return this._approvedById; }
  public get status(): StockAuditStatus { return this._status; }
  public get items(): readonly StockAuditItemEntity[] { return this._items; }

  public addItem(item: StockAuditItemEntity): void {
    if (this._status === 'approved') {
      throw new BadRequestException('Không thể chỉnh sửa phiếu kiểm kê đã được duyệt');
    }
    this._items.push(item);
  }

  /**
   * Thủ kho gửi phiếu kiểm kê để Quản lý duyệt
   */
  public submit(): void {
    if (this._status !== 'draft') {
      throw new BadRequestException('Chỉ phiếu ở trạng thái bản nháp mới được gửi duyệt');
    }
    if (this._items.length === 0) {
      throw new BadRequestException('Phiếu kiểm kê phải có ít nhất 1 dòng kiểm đếm');
    }
    this._status = 'pending';
  }

  /**
   * Quản lý phê duyệt kết quả kiểm kê (UC19)
   */
  public approve(managerId: string): void {
    if (this._status !== 'pending') {
      throw new BadRequestException('Chỉ có thể duyệt phiếu kiểm kê đang chờ duyệt');
    }
    this._approvedById = managerId;
    this._status = 'approved';
  }

  /**
   * Quản lý từ chối kết quả kiểm kê
   */
  public reject(managerId: string): void {
    if (this._status !== 'pending') {
      throw new BadRequestException('Chỉ có thể từ chối phiếu kiểm kê đang chờ duyệt');
    }
    this._approvedById = managerId;
    this._status = 'rejected';
  }

  public getTotalDifference(): number {
    return this._items.reduce((sum, item) => sum + item.difference, 0);
  }
}
