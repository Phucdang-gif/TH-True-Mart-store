import { PartialType } from '@nestjs/mapped-types';
import { CreateStockAuditDto } from './create-stock-audit.dto';

export class UpdateStockAuditDto extends PartialType(CreateStockAuditDto) {}
