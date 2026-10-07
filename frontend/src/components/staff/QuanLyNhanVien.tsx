import React, { useState } from "react";
import {
  ShieldCheck,
  UserPlus,
  KeyRound,
  Search,
  CheckCircle,
  X,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Staff } from "../../types";
import { SHIFT_LABELS, SHIFT_LIST } from "../../lib/labels";

interface QuanLyNhanVienProps {
  staffList: Staff[];
  onAddStaff: (
    staff: Partial<Staff>,
  ) => Promise<{ success: boolean; message?: string }>;
  onUpdateShift: (staffId: string, newShift: Staff["shift"]) => void;
  onDeleteStaff: (id: string) => Promise<void>;
  onChangePassword: (id: string, newPassword: string) => Promise<void>;
}

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export const QuanLyNhanVien: React.FC<QuanLyNhanVienProps> = ({
  staffList,
  onAddStaff,
  onUpdateShift,
  onDeleteStaff,
  onChangePassword,
}) => {
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // State cho modal đổi mật khẩu
  const [passwordTarget, setPasswordTarget] = useState<Staff | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Form tạo nhân viên — KHÔNG có code (backend tự sinh)
  const [newStaff, setNewStaff] = useState<Partial<Staff>>({
    name: "",
    phone: "",
    username: "",
    role: "cashier",
    shift: "SANG",
    status: "active",
  });

  const filteredStaff = staffList.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.username.toLowerCase().includes(search.toLowerCase()),
  );

  // ===== Handlers cũ =====
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.username) {
      alert("Vui lòng nhập tên và tên đăng nhập nhân viên!");
      return;
    }

    const staffToAdd: Partial<Staff> = {
      name: newStaff.name,
      phone: newStaff.phone || "",
      username: newStaff.username,
      password: "123456", // ✅ khớp với ghi chú UI
      role: newStaff.role || "cashier",
      status: "active",
      shift: newStaff.shift || "SANG",
    };

    const res = await onAddStaff(staffToAdd);

    if (res && !res.success) {
      alert(res.message);
    } else {
      setShowAddModal(false);
      setNewStaff({
        name: "",
        phone: "",
        username: "",
        role: "cashier",
        shift: "SANG",
        status: "active",
      });
    }
  };

  // 🆕 Xóa nhân viên
  const handleDeleteStaff = async (staff: Staff) => {
    if (
      !window.confirm(
        `Xóa nhân viên "${staff.name}" (${staff.username})?\n` +
          `Nếu nhân viên đã có hóa đơn/ca làm việc, hệ thống sẽ chuyển sang trạng thái "Ngừng hoạt động" thay vì xóa cứng.`,
      )
    )
      return;

    setDeletingId(staff.id);
    try {
      await onDeleteStaff(staff.id);
    } catch (err) {
      alert(getErrorMessage(err, "Không xóa được nhân viên"));
    } finally {
      setDeletingId(null);
    }
  };

  // 🆕 Mở/đóng modal đổi mật khẩu
  const openPasswordModal = (staff: Staff) => {
    setPasswordTarget(staff);
    setNewPassword("");
    setShowPassword(false);
    setPwError(null);
  };

  const closePasswordModal = () => {
    setPasswordTarget(null);
    setNewPassword("");
    setShowPassword(false);
    setPwError(null);
  };

  // 🆕 Submit đổi mật khẩu
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTarget) return;

    if (newPassword.length < 6) {
      setPwError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    setPwError(null);
    setPwSaving(true);
    try {
      await onChangePassword(passwordTarget.id, newPassword);
      alert(`Đã đổi mật khẩu cho "${passwordTarget.name}"`);
      closePasswordModal();
    } catch (err) {
      setPwError(getErrorMessage(err, "Không đổi được mật khẩu"));
    } finally {
      setPwSaving(false);
    }
  };

  const getRoleBadge = (role: Staff["role"]) => {
    switch (role) {
      case "manager":
        return (
          <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-bold text-[10px]">
            Quản lý cửa hàng (Store Manager)
          </span>
        );
      case "cashier":
        return (
          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-[10px]">
            Thu ngân (POS Cashier)
          </span>
        );
      case "warehouse":
        return (
          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold text-[10px]">
            Thủ kho (Warehouse)
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="font-bold text-sm text-slate-900">
            4. Quản lý nhân viên & Phân quyền
          </h3>
          <p className="text-xs text-slate-500">
            Phân quyền tài khoản bảo mật và quản lý lịch phân ca làm việc tại
            cửa hàng
          </p>
        </div>

        <button
          id="btn-open-add-staff"
          onClick={() => setShowAddModal(true)}
          className="bg-[#004885] hover:bg-[#00386b] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>Thêm nhân viên mới</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Role Permissions Summary Box */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#004885]" />
            <span>5.1 Ma trận phân quyền chức năng</span>
          </h4>
          <div className="space-y-2 text-xs">
            <div className="p-2 bg-sky-50 rounded border border-sky-100">
              <span className="font-bold text-sky-900 block">
                Quản lý cửa hàng
              </span>
              <span className="text-[11px] text-sky-700">
                Toàn quyền: duyệt đổi trả/hoàn tiền, duyệt kết ca và kiểm kê,
                chỉnh giá, khuyến mãi, tài khoản & phân quyền, báo cáo.
              </span>
            </div>
            <div className="p-2 bg-emerald-50 rounded border border-emerald-100">
              <span className="font-bold text-emerald-900 block">
                Thu ngân (Cashier)
              </span>
              <span className="text-[11px] text-emerald-700">
                Tra cứu sản phẩm, tạo đơn POS, thanh toán nhiều hình thức, xác
                nhận chuyển khoản, mở/kết ca thu ngân.
              </span>
            </div>
            <div className="p-2 bg-amber-50 rounded border border-amber-100">
              <span className="font-bold text-amber-900 block">
                Thủ kho (Warehouse)
              </span>
              <span className="text-[11px] text-amber-700">
                Nhập kho lô hàng, xuất kho, kiểm soát HSD, kiểm kê kho, lập đơn
                đặt hàng.
              </span>
            </div>
          </div>
        </div>

        {/* Staff List & Shift Management */}
        <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm nhân viên theo tên, username..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Mã NV</th>
                  <th className="py-2.5 px-3">Họ tên & Tài khoản</th>
                  <th className="py-2.5 px-3">Vai trò phân quyền</th>
                  <th className="py-2.5 px-3">Ca làm việc</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                  <th className="py-2.5 px-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.map((s) => {
                  const isDeleting = deletingId === s.id;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#004885]">
                        {s.code}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">
                          {s.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          @{s.username} • {s.phone}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">{getRoleBadge(s.role)}</td>
                      <td className="py-2.5 px-3">
                        <select
                          value={s.shift}
                          onChange={(e) =>
                            onUpdateShift(
                              s.id,
                              e.target.value as Staff["shift"],
                            )
                          }
                          className="p-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 font-medium"
                        >
                          {SHIFT_LIST.map((sh) => (
                            <option key={sh} value={sh}>
                              {SHIFT_LABELS[sh]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === "active"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {s.status === "active"
                            ? "Đang làm việc"
                            : "Ngừng hoạt động"}
                        </span>
                      </td>

                      {/* Cột thao tác */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openPasswordModal(s)}
                            disabled={isDeleting}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded disabled:opacity-40"
                            title="Đổi mật khẩu"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(s)}
                            disabled={isDeleting}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
                            title="Xóa nhân viên"
                          >
                            {isDeleting ? (
                              <span className="inline-block w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Add Staff */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                5.1 Thêm nhân viên & Cấp tài khoản
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Mã nhân viên
                  </label>
                  <input
                    type="text"
                    value="(Hệ thống tự sinh)"
                    disabled
                    className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    NV001, NV002... cấp tự động
                  </p>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tên đăng nhập
                  </label>
                  <input
                    type="text"
                    placeholder="VD: nam.th"
                    value={newStaff.username}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, username: e.target.value })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Họ và tên nhân viên
                </label>
                <input
                  type="text"
                  placeholder="VD: Hoàng Văn Nam"
                  value={newStaff.name}
                  onChange={(e) =>
                    setNewStaff({ ...newStaff, name: e.target.value })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={newStaff.phone}
                  onChange={(e) =>
                    setNewStaff({ ...newStaff, phone: e.target.value })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Chức vụ / Vai trò
                  </label>
                  <select
                    value={newStaff.role}
                    onChange={(e) =>
                      setNewStaff({
                        ...newStaff,
                        role: e.target.value as Staff["role"],
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="cashier">Thu ngân (Cashier)</option>
                    <option value="warehouse">Thủ kho (Warehouse)</option>
                    <option value="manager">Quản lý cửa hàng</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Phân ca làm việc
                  </label>
                  <select
                    value={newStaff.shift}
                    onChange={(e) =>
                      setNewStaff({
                        ...newStaff,
                        shift: e.target.value as Staff["shift"],
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    {SHIFT_LIST.map((sh) => (
                      <option key={sh} value={sh}>
                        {SHIFT_LABELS[sh]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Mật khẩu khởi tạo (bắt buộc đổi ở lần đăng nhập đầu):{" "}
                <span className="font-mono font-bold text-slate-800">
                  123456
                </span>
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#004885] hover:bg-[#00386b] text-white rounded-lg font-bold shadow-xs"
                >
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Đổi mật khẩu */}
      {passwordTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                Đổi mật khẩu tài khoản
              </h3>
              <button
                onClick={closePasswordModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
              <p className="text-slate-700">
                Nhân viên:{" "}
                <strong className="text-slate-900">
                  {passwordTarget.name}
                </strong>
              </p>
              <p className="text-slate-500 font-mono text-[11px]">
                @{passwordTarget.username}
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Ít nhất 6 ký tự"
                    minLength={6}
                    className="w-full p-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {pwError && <p className="text-red-600 font-medium">{pwError}</p>}

              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 p-2 rounded">
                ⚠️ Sau khi đổi, nhân viên nên đăng xuất và đăng nhập lại bằng
                mật khẩu mới.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-xs disabled:opacity-60"
                >
                  {pwSaving ? "Đang lưu..." : "Đổi mật khẩu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
