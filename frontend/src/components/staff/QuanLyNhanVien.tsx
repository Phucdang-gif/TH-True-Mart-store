import React, { useState } from "react";
import { UserPlus, Search, X, Shield, Lock, Unlock, History, Users, AlertCircle } from "lucide-react";
import { RoleGroupsManager } from "./RoleGroupsManager";
import type { PermissionItem, RoleGroup } from "../../hooks/useRoleGroups";
import { StaffItem, LoginLogItem, CreateStaffInput } from "../../services/staff";

interface QuanLyNhanVienProps {
  staffList: StaffItem[];
  loginLogs: LoginLogItem[];
  isLoading: boolean;
  onAddStaff: (input: CreateStaffInput) => Promise<any>;
  onToggleLock: (staffId: string, lock: boolean) => Promise<any>;
  roles: RoleGroup[] | null;
  permissions: PermissionItem[];
  roleLoadError: string;
  reloadRoles: () => Promise<void>;
  reloadStaff: () => Promise<void>;
}

export const QuanLyNhanVien: React.FC<QuanLyNhanVienProps> = ({
  staffList,
  loginLogs,
  isLoading,
  onAddStaff,
  onToggleLock,
  roles,
  permissions,
  roleLoadError,
  reloadRoles,
  reloadStaff,
}) => {
  const [activeTab, setActiveTab] = useState<"staff" | "logs" | "roles">("staff");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [newStaff, setNewStaff] = useState<CreateStaffInput>({
    code: `NV00${staffList.length + 1}`,
    name: "",
    phone: "",
    username: "",
    password: "TH@12345",
    roleId: roles && roles.length > 0 ? roles[0].id : "",
  });

  const filteredStaff = staffList.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.username.toLowerCase().includes(search.toLowerCase()),
  );

  const handleOpenAdd = () => {
    setModalError(null);
    setNewStaff({
      code: `NV00${staffList.length + 1}`,
      name: "",
      phone: "",
      username: "",
      password: "TH@12345",
      roleId: roles && roles.length > 0 ? roles[0].id : "",
    });
    setShowAddModal(true);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!newStaff.name.trim() || !newStaff.username.trim() || !newStaff.code.trim()) {
      setModalError("Vui lòng điền đầy đủ mã nhân viên, họ tên và tên đăng nhập!");
      return;
    }
    if (!newStaff.roleId) {
      setModalError("Vui lòng chọn vai trò cho nhân viên!");
      return;
    }

    try {
      setSubmitting(true);
      await onAddStaff(newStaff);
      setShowAddModal(false);
    } catch (err: any) {
      setModalError(err?.message || "Lỗi khi tạo nhân viên");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLockStaff = async (staff: StaffItem) => {
    const isCurrentlyLocked = staff.status === "inactive" || (staff.lockedUntil && new Date(staff.lockedUntil) > new Date());
    const actionText = isCurrentlyLocked ? "MỞ KHÓA" : "KHÓA";
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản @${staff.username} (${staff.name})?`)) {
      return;
    }

    try {
      await onToggleLock(staff.id, !isCurrentlyLocked);
    } catch (err: any) {
      alert(err?.message || "Không thể cập nhật trạng thái tài khoản");
    }
  };

  const getRoleBadge = (roleCode: string, roleName?: string) => {
    switch (roleCode) {
      case "manager":
        return (
          <span className="bg-sky-100 text-[#004885] px-2 py-0.5 rounded font-bold text-[10px] border border-sky-200">
            👑 {roleName || "Quản lý cửa hàng"}
          </span>
        );
      case "cashier":
        return (
          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-[10px] border border-emerald-200">
            🛒 {roleName || "Thu ngân"}
          </span>
        );
      case "warehouse":
        return (
          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold text-[10px] border border-amber-200">
            📦 {roleName || "Thủ kho"}
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-[10px]">
            {roleName || roleCode}
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
            5. Quản lý nhân viên & Phân quyền hệ thống
          </h3>
          <p className="text-xs text-slate-500">
            Quản lý tài khoản nhân viên, nhật ký đăng nhập, khóa/mở khóa tài khoản và ma trận phân quyền (BFD 5.1 - 5.4)
          </p>
        </div>

        {activeTab === "staff" && (
          <button
            id="btn-open-add-staff"
            onClick={handleOpenAdd}
            className="bg-[#004885] hover:bg-[#00386b] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm nhân viên mới</span>
          </button>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "staff"
              ? "border-[#004885] text-[#004885]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>5.2 Tài khoản nhân viên ({staffList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "logs"
              ? "border-[#004885] text-[#004885]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <History className="w-4 h-4" />
          <span>5.4 Nhật ký đăng nhập & Khóa tài khoản</span>
        </button>

        <button
          onClick={() => setActiveTab("roles")}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "roles"
              ? "border-[#004885] text-[#004885]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>5.3 Vai trò & Phân quyền (RBAC)</span>
        </button>
      </div>

      {/* TAB 1: Danh sách nhân viên (UC25) */}
      {activeTab === "staff" && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm nhân viên theo tên, mã, username..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:bg-white focus:ring-1 focus:ring-[#004885]"
              />
            </div>
            <button
              onClick={() => reloadStaff()}
              className="text-xs text-sky-700 hover:text-sky-900 font-semibold cursor-pointer"
            >
              Làm mới danh sách
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Mã NV</th>
                  <th className="py-2.5 px-3">Họ tên & Số điện thoại</th>
                  <th className="py-2.5 px-3">Tài khoản đăng nhập</th>
                  <th className="py-2.5 px-3">Vai trò hệ thống</th>
                  <th className="py-2.5 px-3">Đăng nhập gần nhất</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Không tìm thấy nhân viên phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((s) => {
                    const isLocked = s.status === "inactive" || (s.lockedUntil && new Date(s.lockedUntil) > new Date());
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#004885]">
                          {s.code}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{s.name}</div>
                          <div className="text-[11px] text-slate-500">{s.phone}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          @{s.username}
                        </td>
                        <td className="py-2.5 px-3">
                          {getRoleBadge(s.roles?.code, s.roles?.name)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {s.lastLoginAt
                            ? new Date(s.lastLoginAt).toLocaleString("vi-VN")
                            : "Chưa đăng nhập"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              !isLocked
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {!isLocked ? "Hoạt động" : "Bị khóa"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleLockStaff(s)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                              !isLocked
                                ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {!isLocked ? (
                              <>
                                <Lock className="w-3 h-3" />
                                <span>Khóa TK</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3" />
                                <span>Mở khóa</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Nhật ký đăng nhập & Bảo mật tài khoản (UC27) */}
      {activeTab === "logs" && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <History className="w-4 h-4 text-[#004885]" />
                <span>Nhật ký đăng nhập hệ thống (Bảng login_logs)</span>
              </h4>
              <p className="text-[11px] text-slate-500">Ghi vết mọi lượt đăng nhập, tự động khóa khi nhập sai quá 5 lần để đảm bảo an toàn</p>
            </div>
            <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
              Lưu gần nhất: {loginLogs.length} bản ghi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2 px-3">Thời gian</th>
                  <th className="py-2 px-3">Tài khoản & Nhân viên</th>
                  <th className="py-2 px-3">Sự kiện</th>
                  <th className="py-2 px-3 text-center">Kết quả</th>
                  <th className="py-2 px-3">Chi tiết / Lý do</th>
                  <th className="py-2 px-3 font-mono text-[11px]">Địa chỉ IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loginLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Chưa có dữ liệu nhật ký đăng nhập.
                    </td>
                  </tr>
                ) : (
                  loginLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-mono font-bold text-slate-800">@{log.username}</span>
                        {log.staff && (
                          <span className="ml-1 text-[11px] text-slate-500">({log.staff.name})</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          log.event === 'login' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {log.event}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.success ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          {log.success ? "Thành công" : "Thất bại"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {log.reason || "—"}
                      </td>
                      <td className="py-2 px-3 font-mono text-[10px] text-slate-400">
                        {log.ipAddress || "localhost"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Vai trò & Phân quyền (UC26) */}
      {activeTab === "roles" && (
        <RoleGroupsManager
          roles={roles}
          permissions={permissions}
          loadError={roleLoadError}
          onReload={reloadRoles}
        />
      )}

      {/* Modal: Thêm nhân viên mới (UC25) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-[#004885]" />
                <span>5.2 Tạo tài khoản nhân viên mới</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã nhân viên
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaff.code}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, code: e.target.value.toUpperCase() })
                    }
                    placeholder="NV001..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaff.phone}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, phone: e.target.value })
                    }
                    placeholder="0901234567..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên nhân viên
                </label>
                <input
                  type="text"
                  required
                  value={newStaff.name}
                  onChange={(e) =>
                    setNewStaff({ ...newStaff, name: e.target.value })
                  }
                  placeholder="Nguyễn Văn A..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên đăng nhập
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaff.username}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, username: e.target.value.toLowerCase() })
                    }
                    placeholder="username..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono lowercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mật khẩu khởi tạo
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaff.password}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, password: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vai trò & Phân quyền (5.3)
                </label>
                <select
                  value={newStaff.roleId}
                  onChange={(e) =>
                    setNewStaff({ ...newStaff, roleId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                >
                  {roles && roles.length > 0 ? (
                    roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))
                  ) : (
                    <option value="">Chưa có vai trò</option>
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#004885] hover:bg-[#00386b] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Đang lưu..." : "Tạo tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
