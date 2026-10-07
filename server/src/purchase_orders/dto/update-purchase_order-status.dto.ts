import { PurchaseOrderStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

/** pending -> received | cancelled */
export class UpdatePurchaseOrderStatusDto {
  @IsIn([PurchaseOrderStatus.received, PurchaseOrderStatus.cancelled])
  status: 'received' | 'cancelled';
}