import { useState, useEffect } from "react";
import { Supplier } from "../types";
import { suppliersApi, SupplierInput } from "../services/suppliers";

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    suppliersApi
      .list()
      .then(setSuppliers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const addSupplier = async (data: SupplierInput) => {
    const created = await suppliersApi.create(data);
    setSuppliers((prev) => [...prev, created]);
  };

  const updateSupplier = async (id: string, data: Partial<SupplierInput>) => {
    const updated = await suppliersApi.update(id, data);
    setSuppliers((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  const removeSupplier = async (id: string) => {
    await suppliersApi.remove(id);
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  return { suppliers, loading, error, addSupplier, updateSupplier, removeSupplier };
}