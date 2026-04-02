import { Category, PaymentMethod, Product, ProductWithCategory } from '../types'

const API_BASE_URL = ''

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function parseJsonOrThrow(response: Response, defaultMessage: string) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error || defaultMessage)
  }
  return data
}

export type ProductFilters = {
  category_id?: number
  tag?: string
  q?: string
  min_price?: number
  max_price?: number
  brand?: string
  rating?: number
  discount?: number
  free_delivery?: boolean
  sort?: 'price_asc' | 'price_desc' | 'popularity' | 'rating' | 'newest'
  vendor_id?: number
  include_inactive?: boolean
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch(`${API_BASE_URL}/api/categories`, { cache: 'no-store' })
  const data = await parseJsonOrThrow(response, 'Failed to fetch categories')
  if (Array.isArray(data)) return data
  return data.categories || []
}

export async function fetchCategoryTree(): Promise<Category[]> {
  const response = await fetch(`${API_BASE_URL}/api/categories`, { cache: 'no-store' })
  const data = await parseJsonOrThrow(response, 'Failed to fetch categories')
  return data.tree || []
}

export async function fetchProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })

  const url = `${API_BASE_URL}/api/products${params.toString() ? `?${params.toString()}` : ''}`
  const response = await fetch(url, { cache: 'no-store' })
  return parseJsonOrThrow(response, 'Failed to fetch products')
}

export async function fetchProductById(id: number): Promise<ProductWithCategory & { recommendations?: Product[] }> {
  const response = await fetch(`${API_BASE_URL}/api/product/${id}`, { cache: 'no-store' })
  return parseJsonOrThrow(response, 'Failed to fetch product')
}

export async function createProduct(token: string, payload: any) {
  const response = await fetch(`${API_BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload)
  })
  return parseJsonOrThrow(response, 'Failed to create product')
}

export async function updateProduct(token: string, productId: number, payload: any) {
  const response = await fetch(`${API_BASE_URL}/api/product/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload)
  })
  return parseJsonOrThrow(response, 'Failed to update product')
}

export async function deactivateProduct(token: string, productId: number) {
  const response = await fetch(`${API_BASE_URL}/api/product/${productId}`, {
    method: 'DELETE',
    headers: { ...authHeaders(token) }
  })
  return parseJsonOrThrow(response, 'Failed to deactivate product')
}

export async function fetchCategoryProducts(categoryId: number): Promise<Product[]> {
  const response = await fetch(`${API_BASE_URL}/api/categories/${categoryId}/products`, { cache: 'no-store' })
  return parseJsonOrThrow(response, 'Failed to fetch category products')
}

export async function fetchProductReviews(productId: number) {
  const response = await fetch(`${API_BASE_URL}/api/product/${productId}/reviews`, { cache: 'no-store' })
  return parseJsonOrThrow(response, 'Failed to fetch product reviews')
}

export async function submitProductReview(
  token: string,
  productId: number,
  payload: { rating: number; title?: string; comment?: string }
) {
  const response = await fetch(`${API_BASE_URL}/api/product/${productId}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload)
  })
  return parseJsonOrThrow(response, 'Failed to submit review')
}

export async function createOrder(orderData: any, token: string) {
  const response = await fetch(`${API_BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(orderData)
  })
  return parseJsonOrThrow(response, 'Failed to create order')
}

export async function verifyRazorpayPayment(
  token: string,
  payload: {
    order_id: number
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }
) {
  const response = await fetch(`${API_BASE_URL}/api/orders/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload)
  })

  return parseJsonOrThrow(response, 'Failed to verify payment')
}

export async function fetchOrders(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/orders`, {
    headers: { ...authHeaders(token) },
    cache: 'no-store'
  })
  return parseJsonOrThrow(response, 'Failed to fetch orders')
}

export async function fetchOrder(orderId: string | number, token: string) {
  const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
    headers: { ...authHeaders(token) },
    cache: 'no-store'
  })
  return parseJsonOrThrow(response, 'Failed to fetch order')
}

export async function updateOrderAction(
  token: string,
  orderId: string | number,
  payload: { action: string; item_id?: number; status?: string; reason?: string }
) {
  const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload)
  })
  return parseJsonOrThrow(response, 'Failed to update order')
}

export async function fetchOrderHistory(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/orders/history`, {
    headers: { ...authHeaders(token) },
    cache: 'no-store'
  })
  return parseJsonOrThrow(response, 'Failed to fetch order history')
}

export async function signupUser(
  name: string,
  email: string,
  password: string,
  role: 'customer' | 'vendor' | 'admin' = 'customer',
  storeName?: string,
  adminKey?: string
) {
  const response = await fetch(`${API_BASE_URL}/api/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role, storeName, adminKey })
  })
  return parseJsonOrThrow(response, 'Failed to sign up')
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  return parseJsonOrThrow(response, 'Failed to login')
}

export type AuthOtpPurpose = 'signup' | 'login'

export async function sendAuthOtp(email: string, purpose: AuthOtpPurpose) {
  const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, purpose })
  })

  return parseJsonOrThrow(response, 'Failed to send OTP')
}

export async function verifyAuthOtp(payload: {
  email: string
  otp: string
  purpose: AuthOtpPurpose
  name?: string
  password?: string
  role?: 'customer' | 'vendor' | 'admin'
  storeName?: string
  adminKey?: string
}) {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  return parseJsonOrThrow(response, 'Failed to verify OTP')
}

export async function loginWithGoogle(idToken: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  })

  return parseJsonOrThrow(response, 'Failed to authenticate with Google')
}

export async function getCurrentUser(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/me`, {
    headers: { ...authHeaders(token) },
    cache: 'no-store'
  })
  return parseJsonOrThrow(response, 'Failed to fetch current user')
}

export async function fetchCart(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/cart`, {
    headers: { ...authHeaders(token) },
    cache: 'no-store'
  })
  return parseJsonOrThrow(response, 'Failed to fetch cart')
}

export async function addCartItem(token: string, payload: { product_id: number; variant_id?: number | null; quantity?: number }) {
  const response = await fetch(`${API_BASE_URL}/api/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload)
  })
  return parseJsonOrThrow(response, 'Failed to add cart item')
}

export async function updateCartItem(token: string, payload: { cart_item_id: number; quantity: number }) {
  const response = await fetch(`${API_BASE_URL}/api/cart`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload)
  })
  return parseJsonOrThrow(response, 'Failed to update cart item')
}

export async function removeCartItem(token: string, cartItemId: number) {
  const response = await fetch(`${API_BASE_URL}/api/cart`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ cart_item_id: cartItemId })
  })
  return parseJsonOrThrow(response, 'Failed to remove cart item')
}

export async function clearCart(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/cart?clear=true`, {
    method: 'DELETE',
    headers: { ...authHeaders(token) }
  })
  return parseJsonOrThrow(response, 'Failed to clear cart')
}

export async function fetchWishlist(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/wishlist`, {
    headers: { ...authHeaders(token) },
    cache: 'no-store'
  })
  return parseJsonOrThrow(response, 'Failed to fetch wishlist')
}

export async function addWishlistItem(token: string, payload: { product_id: number; variant_id?: number | null }) {
  const response = await fetch(`${API_BASE_URL}/api/wishlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload)
  })
  return parseJsonOrThrow(response, 'Failed to add wishlist item')
}

export async function removeWishlistItem(
  token: string,
  payload: { wishlist_item_id?: number; product_id?: number; variant_id?: number | null }
) {
  const response = await fetch(`${API_BASE_URL}/api/wishlist`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload)
  })
  return parseJsonOrThrow(response, 'Failed to remove wishlist item')
}

export async function fetchVendorDashboard(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/dashboard/vendor`, {
    headers: { ...authHeaders(token) },
    cache: 'no-store'
  })
  return parseJsonOrThrow(response, 'Failed to fetch vendor dashboard')
}

export async function fetchAdminDashboard(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/dashboard/admin`, {
    headers: { ...authHeaders(token) },
    cache: 'no-store'
  })
  return parseJsonOrThrow(response, 'Failed to fetch admin dashboard')
}

export async function fetchReturns(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/returns`, {
    headers: { ...authHeaders(token) },
    cache: 'no-store'
  })
  return parseJsonOrThrow(response, 'Failed to fetch returns')
}

export async function updateReturnStatus(token: string, payload: { return_id: number; status: string }) {
  const response = await fetch(`${API_BASE_URL}/api/returns`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload)
  })
  return parseJsonOrThrow(response, 'Failed to update return status')
}

export async function fetchAddresses(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/addresses`, {
    headers: { ...authHeaders(token) },
    cache: 'no-store'
  })
  return parseJsonOrThrow(response, 'Failed to fetch addresses')
}

export async function saveAddress(
  token: string,
  payload: {
    label?: string
    full_name: string
    phone: string
    line1: string
    line2?: string
    city: string
    state: string
    pincode: string
    country?: string
    is_default?: boolean
  }
) {
  const response = await fetch(`${API_BASE_URL}/api/addresses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload)
  })
  return parseJsonOrThrow(response, 'Failed to save address')
}

export async function setDefaultAddress(token: string, addressId: number) {
  const response = await fetch(`${API_BASE_URL}/api/addresses`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ address_id: addressId })
  })
  return parseJsonOrThrow(response, 'Failed to set default address')
}

export function getPaymentOptions(): Array<{ id: PaymentMethod; label: string }> {
  return [
    { id: 'card', label: 'Credit / Debit Card' },
    { id: 'upi', label: 'UPI' },
    { id: 'netbanking', label: 'Net Banking' },
    { id: 'wallet', label: 'Wallets' },
    { id: 'cod', label: 'Cash on Delivery' }
  ]
}
