import React, { useMemo, useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { fetchApi } from "../../lib/api";
import type { PermissionItem, RoleGroup } from "../../hooks/useRoleGroups";

interface Props {
  roles: RoleGroup[] | null;
  permissions: PermissionItem[];
  loadError: string;
  onReload: () => Promise<void>;
}

const MODULE_LABELS: Record<string, string> = {
  sales: "Bán hàng & thanh toán",
  product: "Hàng hóa",
  promotion: "Khuyến mãi",
  inventory: "Kho",
  staff: "Nhân viên",
  supplier: "Nhà cung cấp",
  report: "Báo cáo",
  system: "Hệ thống",
};

const ROLE_LABELS: Record<string, string> = {
  manager: "Quản lý",
  cashier: "Thu ngân",
  warehouse: "Thủ kho",
};

export const RoleGroupsManager: React.FC<Props> = ({
  roles,
  permissions,
  loadError,
  onReload,
}) => {
  const [editing, setEditing] = useState<RoleGroup | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", description: "", permissionIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const permissionsByModule = useMemo(() => {
    return permissions.reduce<Record<string, PermissionItem[]>>((groups, item) => {
      (groups[item.module] ??= []).push(item);
      return groups;
    }, {});
  }, [permissions]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name: "", description: "", permissionIds: [] });
    setError("");
    setIsOpen(true);
  };

  const openEdit = (role: RoleGroup) => {
    setEditing(role);
    setForm({
      code: role.code,
      name: role.name,
      description: role.description ?? "",
      permissionIds: role.role_permissions.map((link) => link.permissions.id),
    });
    setError("");
    setIsOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        ...(editing?.isSystem ? {} : { code: form.code.trim(), name: form.name.trim() }),
        description: form.description.trim(),
        permissionIds: form.permissionIds,
      };
      if (editing) {
        await fetchApi(`/api/roles/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await fetchApi("/api/roles", { method: "POST", body: JSON.stringify(body) });
      }
      setIsOpen(false);
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được nhóm quyền");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role: RoleGroup) => {
    if (!window.confirm(`Xóa nhóm quyền “${role.name}”?`)) return;
    setError("");
    try {
      await fetchApi(`/api/roles/${role.id}`, { method: "DELETE" });
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xóa được nhóm quyền");
    }
  };

  return (
    <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#004885]" /> Nhóm quyền
        </h4>
        <button onClick={openCreate} className="text-[11px] font-bold text-white bg-[#004885] hover:bg-[#00386b] rounded-lg px-2.5 py-1.5 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Tạo nhóm
        </button>
      </div>

      {(loadError || error) && <p className="text-[11px] text-rose-700 bg-rose-50 rounded p-2">{error || loadError}</p>}

      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {!roles && !loadError && <p className="text-xs text-slate-500">Đang tải nhóm quyền…</p>}
        {roles?.map((role) => (
          <div key={role.id} className="rounded-lg border border-slate-200 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">{ROLE_LABELS[role.code] ?? role.name}</span>
                  {role.isSystem && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Hệ thống</span>}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">{role.description || `Mã: ${role.code}`}</p>
                <p className="text-[10px] text-slate-600 mt-1">{role.role_permissions.length} quyền được cấp</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button aria-label={`Sửa ${role.name}`} onClick={() => openEdit(role)} className="p-1.5 text-slate-500 hover:text-[#004885] hover:bg-sky-50 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                {!role.isSystem && <button aria-label={`Xóa ${role.name}`} onClick={() => void remove(role)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4">
          <form onSubmit={(event) => void save(event)} className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">{editing ? "Cập nhật nhóm quyền" : "Tạo nhóm quyền"}</h3>
                {editing?.isSystem && <p className="text-[11px] text-slate-500 mt-1">Ba nhóm quyền nền tảng luôn được giữ lại; có thể cập nhật danh sách quyền.</p>}
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!editing?.isSystem && <>
                <label className="text-[11px] font-semibold text-slate-700 space-y-1">Mã nhóm quyền
                  <input required pattern="[a-z][a-z0-9_-]*" maxLength={50} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="vd: store_supervisor" className="block w-full rounded-lg border border-slate-200 p-2 text-xs font-mono" />
                </label>
                <label className="text-[11px] font-semibold text-slate-700 space-y-1">Tên nhóm quyền
                  <input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="block w-full rounded-lg border border-slate-200 p-2 text-xs" />
                </label>
              </>}
              <label className="text-[11px] font-semibold text-slate-700 space-y-1 sm:col-span-2">Mô tả
                <input maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="block w-full rounded-lg border border-slate-200 p-2 text-xs" />
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-800">Quyền được cấp</p>
                <span className="text-[10px] text-slate-500">Đã chọn {form.permissionIds.length}/{permissions.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(permissionsByModule).map(([module, items]) => (
                  <fieldset key={module} className="border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                    <legend className="px-1 text-[11px] font-bold text-[#004885]">{MODULE_LABELS[module] ?? module}</legend>
                    {items.map((permission) => {
                      const checked = form.permissionIds.includes(permission.id);
                      return <label key={permission.id} className="flex items-start gap-2 text-[10px] text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={checked} disabled={editing?.code === "manager" && permission.code === "staff:manage"} onChange={() => setForm({
                          ...form,
                          permissionIds: checked
                            ? form.permissionIds.filter((id) => id !== permission.id)
                            : [...form.permissionIds, permission.id],
                        })} className="mt-0.5 accent-[#004885]" />
                        <span>{permission.name}<span className="block text-[9px] text-slate-400 font-mono">{permission.code}</span></span>
                      </label>;
                    })}
                  </fieldset>
                ))}
              </div>
            </div>

            {error && <p className="text-[11px] text-rose-700 bg-rose-50 rounded p-2">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setIsOpen(false)} className="px-3 py-2 text-xs rounded-lg text-slate-600 hover:bg-slate-100">Hủy</button>
              <button disabled={saving} type="submit" className="px-3 py-2 text-xs rounded-lg bg-[#004885] text-white font-bold disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu nhóm quyền"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

