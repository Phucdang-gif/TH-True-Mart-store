import { useState, useEffect } from 'react';
import { Staff } from '../types';
import { staffService } from '../services/staff';

export const useStaff = () => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const data = await staffService.getAll();
      setStaffList(data);
      setError(null);
    } catch (error: any) {
      console.error('Lỗi khi tải danh sách nhân viên:', error.message);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const addStaff = async (newStaff: Partial<Staff>) => {
    try {
      const data = await staffService.create(newStaff);
      setStaffList((prev) => [data, ...prev]);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || 'Có lỗi xảy ra' };
    }
  };

  const updateShift = async (id: string, newShift: string) => {
    try {
      const data = await staffService.update(id, {
        shift: newShift as Staff['shift'],
      });
      setStaffList((prev) => prev.map((s) => (s.id === id ? data : s)));
    } catch (error: any) {
      console.error('Lỗi khi cập nhật ca làm:', error.message);
    }
  };

  // 🆕 Xóa nhân viên — reload để phản ánh đúng cả trường hợp soft-delete
  const removeStaff = async (id: string) => {
    await staffService.delete(id);
    // Xóa cứng → biến mất; xóa mềm → còn với status='inactive'
    // → reload để đồng bộ
    await fetchStaff();
  };

  // 🆕 Đổi mật khẩu
  const changePassword = async (id: string, newPassword: string) => {
    await staffService.changePassword(id, newPassword);
    // Không cần update state vì password không hiển thị ở UI
  };

  return {
    staffList,
    loading,
    error,
    reload: fetchStaff,
    addStaff,
    updateShift,
    removeStaff,
    changePassword,
  };
};