import { useState, useEffect } from 'react';
import { Staff } from '../types';
import { staffService } from '../services/staff';

export const useStaff = () => {
  const [staffList, setStaffList] = useState<Staff[]>([]);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      // Nhận trực tiếp mảng Staff[] do fetchApi trả về
      const data = await staffService.getAll();
      setStaffList(data);
    } catch (error: any) {
      console.error('Lỗi khi tải danh sách nhân viên:', error.message);
    }
  };

  const addStaff = async (newStaff: Partial<Staff>) => {
    try {
      const data = await staffService.create(newStaff);
      setStaffList((prev) => [data, ...prev]);
      return { success: true };
    } catch (error: any) {
      // Lấy câu thông báo lỗi (vd: "Tên đăng nhập đã tồn tại") từ fetchApi
      return { success: false, message: error.message || 'Có lỗi xảy ra' };
    }
  };

  const updateShift = async (id: string, newShift: string) => {
    try {
      const data = await staffService.update(id, { shift: newShift as Staff['shift'] });
      setStaffList((prev) => prev.map((s) => (s.id === id ? data : s)));
    } catch (error: any) {
      console.error('Lỗi khi cập nhật ca làm:', error.message);
    }
  };

  return { staffList, addStaff, updateShift };
};