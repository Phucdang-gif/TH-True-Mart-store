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
  };

  const updateProductPrice = async (
    id: string,
    sellingPrice: number,
    costPrice: number,
  ) => {
    const updated = await productsApi.update(id, { sellingPrice, costPrice });
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
  };

  return { products, loading, error, addProduct, updateProductPrice };
}