import { IsIn } from 'class-validator';

export class ChangePromotionStatusDto {
  @IsIn(['activate', 'pause', 'end'], { message: 'Hành động chỉ được là activate, pause hoặc end' })
  action: 'activate' | 'pause' | 'end';
}