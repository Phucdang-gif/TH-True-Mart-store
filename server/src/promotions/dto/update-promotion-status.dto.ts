import { PromotionStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdatePromotionStatusDto {
  @IsEnum(PromotionStatus)
  status: PromotionStatus;
}
