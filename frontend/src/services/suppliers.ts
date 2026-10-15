import { fetchApi } from "../lib/api";
import { Supplier } from "../types";

export type SupplierInput = Omit<Supplier, "id">;

export const suppliersApi = {
  list: () => fetchApi<Supplier[]>("/api/suppliers"),
  create: (data: SupplierInput) =>
    fetchApi<Supplier>("/api/suppliers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<SupplierInput>) =>
    fetchApi<Supplier>(`/api/suppliers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchApi<void>(`/api/suppliers/${id}`, { method: "DELETE" }),
};