import { fetchApi } from '../lib/api';
import { Staff } from '../types';

export const staffService = {
  getAll: () => 
    fetchApi<Staff[]>('/api/staff', { method: 'GET' }),
    
  create: (data: Partial<Staff>) => 
    fetchApi<Staff>('/api/staff', { method: 'POST', body: JSON.stringify(data) }),
    
  update: (id: string, data: Partial<Staff>) => 
    fetchApi<Staff>(`/api/staff/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    
  delete: (id: string) => 
    fetchApi<Staff>(`/api/staff/${id}`, { method: 'DELETE' }),
};