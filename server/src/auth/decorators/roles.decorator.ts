import { SetMetadata } from '@nestjs/common';

// Custom decorator để định nghĩa các role được phép truy cập API
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);