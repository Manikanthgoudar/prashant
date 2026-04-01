import { Category, Product, ProductWithCategory } from "../types";

const API_BASE_URL = ""; // use same-origin Next.js API routes

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch(`${API_BASE_URL}/api/categories`);
  if (!response.ok) throw new Error("Failed to fetch categories");
  return response.json();
}

export async function fetchProducts(categoryId?: number, q?: string): Promise<Product[]> {
  const params = new URLSearchParams()
  if (categoryId) params.set('category_id', String(categoryId))
  if (q) params.set('q', q)
  const url = `${API_BASE_URL}/api/products${params.toString() ? `?${params.toString()}` : ''}`
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch products");
  return response.json();
}

export async function fetchProductById(id: number): Promise<ProductWithCategory> {
  const response = await fetch(`${API_BASE_URL}/api/product/${id}`);
  if (!response.ok) throw new Error("Failed to fetch product");
  return response.json();
}

export async function fetchCategoryProducts(categoryId: number): Promise<Product[]> {
  const response = await fetch(`${API_BASE_URL}/api/categories/${categoryId}/products`);
  if (!response.ok) throw new Error("Failed to fetch category products");
  return response.json();
}

export async function createOrder(orderData: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${API_BASE_URL}/api/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify(orderData)
  });
  if (!response.ok) throw new Error("Failed to create order");
  return response.json();
}

export async function fetchOrder(orderId: string) {
  const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`);
  if (!response.ok) throw new Error("Failed to fetch order");
  return response.json();
}

export async function fetchOrderHistory(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/orders/history`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!response.ok) throw new Error('Failed to fetch order history')
  return response.json()
}

export async function signupUser(name: string, email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  if (!response.ok) throw new Error("Failed to sign up");
  return response.json();
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) throw new Error("Failed to login");
  return response.json();
}

export async function getCurrentUser(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) throw new Error("Failed to fetch current user");
  return response.json();
}
