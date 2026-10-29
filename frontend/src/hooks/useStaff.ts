import { useState, useEffect, useCallback } from 'react';
import { staffService, StaffItem, LoginLogItem, CreateStaffInput } from '../services/staff';

export function useStaff() {
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    try {
      setError(null);
      const data = await staffService.getAll();
      setStaffList(data);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách nhân viên');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await staffService.getLoginLogs();
      setLoginLogs(data);
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchLogs();
  }, [fetchStaff, fetchLogs]);

  const addStaff = async (input: CreateStaffInput) => {
    const created = await staffService.create(input);
    await fetchStaff();
    return created;
  };

  const toggleLock = async (id: string, lock: boolean) => {
    const updated = await staffService.toggleLock(id, lock);
    await Promise.all([fetchStaff(), fetchLogs()]);
    return updated;
  };

  return {
    staffList,
    loginLogs,
    isLoading,
    error,
    reloadStaff: fetchStaff,
    reloadLogs: fetchLogs,
    addStaff,
    toggleLock,
  };
}
