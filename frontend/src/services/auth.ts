import { fetchApi } from '../lib/api';

export interface AuthStaff {
  id: string;
  code: string;
  name: string;
  phone: string;
  username: string;
  role: 'manager' | 'cashier' | 'warehouse';
  roleName: string;
  mustChangePassword?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  staff: AuthStaff;
  permissions: string[];
}

export interface DemoAccount {
  code: string;
  name: string;
  username: string;
  role: string;
  roleName: string;
  defaultPassword: string;
}

const TOKEN_KEY = 'th_access_token';
const USER_KEY = 'th_user_info';
const PERMS_KEY = 'th_user_permissions';

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await fetchApi<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    localStorage.setItem(TOKEN_KEY, res.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.staff));
    localStorage.setItem(PERMS_KEY, JSON.stringify(res.permissions));

    return res;
  },

  async logout(): Promise<void> {
    const user = this.getCurrentUser();
    try {
      await fetchApi('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ staffId: user?.id, username: user?.username }),
      });
    } catch {
      // Ignored on logout
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(PERMS_KEY);
    }
  },

  async getDemoAccounts(): Promise<DemoAccount[]> {
    return fetchApi<DemoAccount[]>('/api/auth/demo-accounts');
  },

  getCurrentUser(): AuthStaff | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getSavedPermissions(): string[] | null {
    const raw = localStorage.getItem(PERMS_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
};
