import { fetchApi } from '../lib/api';
import { Staff } from '../types';

export const staffService = {
  getAll: () => fetchApi<Staff[]>('/api/staff', { method: 'GET' }),

  create: (data: Partial<Staff>) =>
    fetchApi<Staff>('/api/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Staff>) =>
    fetchApi<Staff>(`/api/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // 🆕 Đổi mật khẩu = gọi PATCH update với field password
  // Backend đã tự băm bcrypt + set mustChangePassword=false
  changePassword: (id: string, newPassword: string) =>
    fetchApi<Staff>(`/api/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ password: newPassword }),
    }),

  // Backend trả về Staff (kể cả khi soft-delete → status='inactive')
  delete: (id: string) =>
    fetchApi<Staff>(`/api/staff/${id}`, { method: 'DELETE' }),
};