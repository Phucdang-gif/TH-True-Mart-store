import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePromotionDto } from './create-promotion.dto';

/** Đổi trạng thái đi qua PATCH :id/status */
export class UpdatePromotionDto extends PartialType(OmitType(CreatePromotionDto, ['status'] as const)) {}
