import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "../lib/api";

export interface PermissionItem {
  id: string;
  code: string;
  module: string;
  name: string;
  description?: string | null;
}

export interface RolePermissionLink {
  permissions: PermissionItem;
}

export interface RoleGroup {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  role_permissions: RolePermissionLink[];
}

export function useRoleGroups() {
  const [roles, setRoles] = useState<RoleGroup[] | null>(null);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const [roleData, permissionData] = await Promise.all([
        fetchApi<RoleGroup[]>("/api/roles"),
        fetchApi<PermissionItem[]>("/api/roles/permissions"),
      ]);
      setRoles(roleData);
      setPermissions(permissionData);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được nhóm quyền");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { roles, permissions, error, reload };
}
