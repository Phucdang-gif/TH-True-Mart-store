import { PartialType } from '@nestjs/mapped-types';
import { CreatePurchaseOrderDto } from './create-purchase_order.dto';

export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {}
