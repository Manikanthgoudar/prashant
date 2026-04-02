CREATE DATABASE IF NOT EXISTS ecom CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ecom CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'vendor', 'customer') NOT NULL DEFAULT 'customer',
  phone VARCHAR(24),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
);

CREATE TABLE IF NOT EXISTS vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  store_name VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url VARCHAR(512),
  gst_number VARCHAR(64),
  payout_upi VARCHAR(128),
  payout_bank_account VARCHAR(128),
  payout_ifsc VARCHAR(32),
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  rating DECIMAL(3, 2) NOT NULL DEFAULT 0,
  total_sales DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vendors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  icon VARCHAR(255),
  description VARCHAR(512),
  parent_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_categories_parent (parent_id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  category_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  brand VARCHAR(255),
  price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(512),
  stock INT NOT NULL DEFAULT 0,
  colors VARCHAR(255),
  discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
  avg_rating DECIMAL(3, 2) NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_vendor (vendor_id),
  INDEX idx_products_category (category_id),
  INDEX idx_products_price (price),
  INDEX idx_products_brand (brand),
  FULLTEXT INDEX idx_products_search (name, description, brand),
  CONSTRAINT fk_products_vendor FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  image_url VARCHAR(512) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_images_product (product_id),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_tags (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  tag VARCHAR(64) NOT NULL,
  normalized_tag VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_product_tag (product_id, normalized_tag),
  INDEX idx_product_tags_lookup (normalized_tag),
  CONSTRAINT fk_product_tags_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  sku VARCHAR(128) NOT NULL UNIQUE,
  color VARCHAR(64),
  size VARCHAR(32),
  additional_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  image_url VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_product_variants_product (product_id),
  INDEX idx_product_variants_color_size (color, size),
  CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS addresses (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  label VARCHAR(64),
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(24) NOT NULL,
  line1 VARCHAR(255) NOT NULL,
  line2 VARCHAR(255),
  city VARCHAR(128) NOT NULL,
  state VARCHAR(128) NOT NULL,
  pincode VARCHAR(16) NOT NULL,
  country VARCHAR(64) NOT NULL DEFAULT 'India',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_addresses_user (user_id),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wishlists (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wishlists_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  wishlist_id BIGINT NOT NULL,
  product_id INT NOT NULL,
  variant_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_wishlist_product_variant (wishlist_id, product_id, variant_id),
  INDEX idx_wishlist_items_wishlist (wishlist_id),
  INDEX idx_wishlist_items_product (product_id),
  CONSTRAINT fk_wishlist_items_wishlist FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  variant_id BIGINT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cart_product_variant (user_id, product_id, variant_id),
  INDEX idx_cart_user (user_id),
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  address_id BIGINT NULL,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  delivery_charge DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('placed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'returned', 'refunded') NOT NULL DEFAULT 'placed',
  payment_method ENUM('card', 'upi', 'netbanking', 'wallet', 'cod') NOT NULL,
  payment_provider ENUM('mock', 'razorpay') NOT NULL DEFAULT 'mock',
  payment_status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  payment_reference VARCHAR(128),
  razorpay_order_id VARCHAR(128),
  tracking_number VARCHAR(64),
  contact_number VARCHAR(24),
  order_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_created (created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_address FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_id INT NOT NULL,
  variant_id BIGINT NULL,
  vendor_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  color VARCHAR(64),
  size VARCHAR(32),
  quantity INT NOT NULL,
  price_each DECIMAL(10, 2) NOT NULL,
  discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
  line_subtotal DECIMAL(10, 2) NOT NULL,
  platform_commission DECIMAL(10, 2) NOT NULL DEFAULT 0,
  vendor_payout DECIMAL(10, 2) NOT NULL DEFAULT 0,
  line_total DECIMAL(10, 2) NOT NULL,
  status ENUM('placed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'return_requested', 'returned', 'refunded') NOT NULL DEFAULT 'placed',
  mock_tracking_number VARCHAR(64),
  return_reason VARCHAR(512),
  refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_items_order (order_id),
  INDEX idx_order_items_vendor (vendor_id),
  INDEX idx_order_items_product (product_id),
  INDEX idx_order_items_status (status),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_items_vendor FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  order_item_id BIGINT NULL,
  customer_id INT NULL,
  vendor_id INT NULL,
  transaction_type ENUM('payment', 'commission', 'vendor_payout', 'refund') NOT NULL,
  gross_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  commission_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payout_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_method ENUM('card', 'upi', 'netbanking', 'wallet', 'cod') NULL,
  reference VARCHAR(128),
  status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'success',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_transactions_order (order_id),
  INDEX idx_transactions_vendor (vendor_id),
  INDEX idx_transactions_customer (customer_id),
  INDEX idx_transactions_created (created_at),
  CONSTRAINT fk_transactions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_transactions_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_transactions_vendor FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id INT NOT NULL,
  rating TINYINT NOT NULL,
  title VARCHAR(255),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_reviews_product_user (product_id, user_id),
  INDEX idx_reviews_product (product_id),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS returns_refunds (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_item_id BIGINT NOT NULL UNIQUE,
  user_id INT NOT NULL,
  reason VARCHAR(512),
  status ENUM('requested', 'approved', 'rejected', 'completed', 'refunded') NOT NULL DEFAULT 'requested',
  refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_returns_user (user_id),
  INDEX idx_returns_status (status),
  CONSTRAINT fk_returns_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_returns_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_otps (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  purpose ENUM('signup', 'login') NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_otps_lookup (email, purpose, created_at),
  INDEX idx_email_otps_expiry (expires_at)
);
