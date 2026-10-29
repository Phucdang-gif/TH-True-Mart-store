import { fetchApi } from '../lib/api';

export interface StaffItem {
  id: string;
  code: string;
  name: string;
  phone: string;
  username: string;
  roleId: string;
  status: 'active' | 'inactive';
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  roles: {
    id: string;
    code: string;
    name: string;
  };
}

export interface CreateStaffInput {
  code: string;
  name: string;
  phone: string;
  username: string;
  password: string;
  roleId: string;
}

export interface LoginLogItem {
  id: string;
  staffId: string | null;
  username: string;
  event: string;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  staff?: {
    code: string;
    name: string;
  } | null;
}

export const staffService = {
  async getAll(): Promise<StaffItem[]> {
    return fetchApi<StaffItem[]>('/api/staff');
  },

  async create(input: CreateStaffInput): Promise<StaffItem> {
    return fetchApi<StaffItem>('/api/staff', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async toggleLock(id: string, lock: boolean): Promise<StaffItem> {
    return fetchApi<StaffItem>(`/api/staff/${id}/toggle-lock`, {
      method: 'PATCH',
      body: JSON.stringify({ lock }),
    });
  },

  async getLoginLogs(): Promise<LoginLogItem[]> {
    return fetchApi<LoginLogItem[]>('/api/staff/login-logs');
  },
};
