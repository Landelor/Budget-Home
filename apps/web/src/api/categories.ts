import { apiFetch } from "./client.js";

export interface Category {
  id: string;
  userId: string | null;
  name: string;
  color: string;
  icon: string;
  parentCategoryId: string | null;
}

export function listCategories(): Promise<Category[]> {
  return apiFetch<Category[]>("/categories");
}
