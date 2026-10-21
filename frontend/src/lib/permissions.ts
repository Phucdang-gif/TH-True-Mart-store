import type { StaffRole } from "../types";

/**
 * Quyền truy cập các màn hình điều hướng theo vai trò.
 * Khi API đăng nhập sẵn sàng, thay role lấy từ hồ sơ nhân viên đã xác thực.
 */
export const MODULE_PERMISSIONS: Record<StaffRole, readonly number[]> = {
  manager: [1, 2, 3, 4, 5, 6],
  cashier: [1],
  warehouse: [2, 3, 5],
};

export function canAccessModule(role: StaffRole, moduleId: number): boolean {
  return MODULE_PERMISSIONS[role]?.includes(moduleId) ?? false;
}
