import { fetchApi } from "../lib/api";
import { toNum } from "../lib/labels";
import { Product } from "../types";

// Dữ liệu gửi lên khi tạo / cập nhật sản phẩm - khớp CreateProductDto / UpdateProductDto
export type ProductInput = Omit<Product, "id">;

// Prisma trả DECIMAL dạng chuỗi ("38000.00") -> ép về số.
// Dùng chung cho list / create / update để mọi nơi nhận Product đều có giá là số.
const normalize = (p: any): Product => ({
  ...p,
  categoryId: p.categoryId || p.product_categories?.id,
  category: p.product_categories?.code || p.category || "",
  categoryName: p.product_categories?.name,
  sellingPrice: toNum(p.sellingPrice),
  costPrice: toNum(p.costPrice),
  discountPercent:
    p.discountPercent == null ? undefined : toNum(p.discountPercent),
});

export const productsApi = {
  list: async () => (await fetchApi<any[]>("/api/products")).map(normalize),

  create: async (data: ProductInput) =>
    normalize(
      await fetchApi<any>("/api/products", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ),

  update: async (id: string, data: Partial<ProductInput>) =>
    normalize(
      await fetchApi<any>(`/api/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ),
};
