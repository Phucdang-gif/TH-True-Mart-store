import { useState, useEffect } from "react";
import { Product } from "../types";
import { productsApi, ProductInput } from "../services/products";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    productsApi
      .list()
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const addProduct = async (data: ProductInput) => {
    const created = await productsApi.create(data);
    setProducts((prev) => [...prev, created]);
    return created;
  };

  const updateProduct = async (id: string, data: Partial<ProductInput>) => {
    const updated = await productsApi.update(id, data);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };

  const updateProductPrice = async (
    id: string,
    sellingPrice: number,
    costPrice: number,
  ) => {
    return updateProduct(id, { sellingPrice, costPrice });
  };

  return { products, loading, error, addProduct, updateProduct, updateProductPrice };
}
