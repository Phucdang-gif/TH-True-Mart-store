const MODULE_PERMISSION_CODES: Record<number, readonly string[]> = {
  1: ["product:view", "invoice:create", "invoice:view", "payment:process"],
  2: ["product:view", "product:manage", "product:price", "category:manage", "promotion:manage"],
  3: ["batch:import", "stock:export", "stock:audit", "stock:audit_approve", "stock:alert"],
  4: ["staff:manage"],
  5: ["supplier:view", "supplier:manage", "purchase:create"],
  6: ["report:view"],
};

/** A module link is visible when its role has at least one permission for it. */
export function canAccessModule(
  permissionCodes: readonly string[] | null,
  moduleId: number,
): boolean {
  // Keep the prototype usable while role configuration is loading.
  if (permissionCodes === null) return true;
  return (MODULE_PERMISSION_CODES[moduleId] ?? []).some((code) => permissionCodes.includes(code));
}
