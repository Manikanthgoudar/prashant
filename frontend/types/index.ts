export type UserRole = 'admin' | 'vendor' | 'customer'

export type PaymentMethod = 'card' | 'upi' | 'netbanking' | 'wallet' | 'cod'

export type OrderItemStatus =
  | 'placed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'return_requested'
  | 'returned'
  | 'refunded'

export interface Category {
  id: number
  name: string
  slug?: string
  icon?: string
  description?: string
  parent_id?: number | null
  children?: Category[]
}

export interface ProductVariant {
  id: number
  product_id: number
  sku: string
  color?: string | null
  size?: string | null
  additional_price: number
  stock: number
  image_url?: string | null
}

export interface ProductImage {
  id: number
  product_id: number
  image_url: string
  sort_order: number
}

export interface Product {
  id: number
  vendor_id: number
  vendor_name?: string
  vendor_store_name?: string
  name: string
  description: string
  brand?: string
  price: number
  image_url: string
  stock: number
  category_id: number
  category_name?: string
  colors?: string
  discount_percent?: number
  avg_rating?: number
  review_count?: number
  effective_price?: number
  free_delivery?: boolean
  tags?: string[]
  images?: ProductImage[]
  variants?: ProductVariant[]
}

export interface ProductWithCategory extends Product {
  category: Category
}

export interface Address {
  id: number
  label?: string
  full_name: string
  phone: string
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
  country: string
  is_default: boolean
}

export interface CartItem {
  id: number
  user_id?: number
  product_id: number
  variant_id?: number | null
  quantity: number
  product_name: string
  price: number
  image_url: string
  vendor_id: number
  vendor_name?: string
  color?: string | null
  size?: string | null
  discount_percent?: number
  effective_price?: number
}

export interface OrderItem {
  id: number
  order_id: number
  product_id: number
  variant_id?: number | null
  vendor_id: number
  vendor_name?: string
  product_name: string
  color?: string | null
  size?: string | null
  quantity: number
  price_each: number
  discount_percent: number
  line_total: number
  platform_commission: number
  vendor_payout: number
  status: OrderItemStatus
  mock_tracking_number?: string | null
  return_reason?: string | null
  refund_amount?: number
}

export interface Order {
  id: number
  user_id: number
  subtotal: number
  delivery_charge: number
  discount_amount: number
  total_amount: number
  status: OrderItemStatus | 'placed'
  payment_method: PaymentMethod
  payment_provider: 'mock' | 'razorpay'
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
  payment_reference?: string
  tracking_number?: string
  contact_number?: string
  order_notes?: string
  created_at: string
  items?: OrderItem[]
}

export interface TransactionRow {
  id: number
  order_id: number
  order_item_id?: number | null
  customer_id?: number | null
  vendor_id?: number | null
  transaction_type: 'payment' | 'commission' | 'vendor_payout' | 'refund'
  gross_amount: number
  commission_amount: number
  payout_amount: number
  refund_amount: number
  payment_method?: PaymentMethod
  reference?: string
  status: 'pending' | 'success' | 'failed'
  created_at: string
}

export interface Review {
  id: number
  product_id: number
  user_id: number
  user_name?: string
  rating: number
  title?: string
  comment?: string
  created_at: string
}

export interface DashboardKpi {
  gross_sales: number
  platform_commission: number
  vendor_payout: number
  refunds: number
  order_count: number
}
