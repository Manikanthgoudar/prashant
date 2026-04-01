export interface Category {
  id: number;
  name: string;
  icon?: string;
  parent_id?: number;
  children?: Category[];
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  category_id: number;
  colors?: string; // Comma separated colors
}

export interface ProductWithCategory extends Product {
  category: Category;
}
