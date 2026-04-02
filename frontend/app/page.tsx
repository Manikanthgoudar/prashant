'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Category, Product } from '../types'
import { addCartItem, addWishlistItem, fetchCategories, fetchProducts, ProductFilters } from '../lib/api'
import Hero from '../components/Hero'

export const dynamic = 'force-dynamic'

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([])
  const [displayProducts, setDisplayProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [rating, setRating] = useState('')
  const [discount, setDiscount] = useState('')
  const [freeDeliveryOnly, setFreeDeliveryOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'popularity' | 'rating' | 'newest'>('newest')
  const router = useRouter()

  const loadProducts = async (overrides?: Partial<ProductFilters>) => {
    setLoading(true)
    try {
      const products = await fetchProducts({
        category_id: activeCategoryId || undefined,
        q: searchQuery || undefined,
        min_price: minPrice ? Number(minPrice) : undefined,
        max_price: maxPrice ? Number(maxPrice) : undefined,
        brand: selectedBrand || undefined,
        tag: selectedTag || undefined,
        rating: rating ? Number(rating) : undefined,
        discount: discount ? Number(discount) : undefined,
        free_delivery: freeDeliveryOnly || undefined,
        sort: sortBy,
        ...overrides
      })
      setDisplayProducts(products)
      document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q')
    if (q) setSearchQuery(q)

    fetchCategories()
      .then((cats) => setCategories(cats))
      .catch((err) => console.error(err))
      .finally(() => {
        loadProducts().catch((err) => console.error(err))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCategoryClick = async (id: number) => {
    setActiveCategoryId(id)
    await loadProducts({ category_id: id })
  }

  const clearFilters = async () => {
    setActiveCategoryId(null)
    setMinPrice('')
    setMaxPrice('')
    setSelectedBrand('')
    setSelectedTag('')
    setRating('')
    setDiscount('')
    setFreeDeliveryOnly(false)
    await loadProducts({
      category_id: undefined,
      min_price: undefined,
      max_price: undefined,
      brand: undefined,
      tag: undefined,
      rating: undefined,
      discount: undefined,
      free_delivery: undefined
    })
  }

  const addToCart = async (product: Product) => {
    const session = localStorage.getItem('stella-user')
    if (!session) {
      router.push('/signup')
      return
    }

    const parsed = JSON.parse(session)
    try {
      await addCartItem(parsed.token, { product_id: product.id, quantity: 1 })
      window.dispatchEvent(new Event('stella-cart-update'))
      router.push('/cart')
    } catch (err) {
      console.error(err)
      alert('Unable to add to cart')
    }
  }

  const addToWishlist = async (product: Product) => {
    const session = localStorage.getItem('stella-user')
    if (!session) {
      router.push('/signup')
      return
    }

    const parsed = JSON.parse(session)
    try {
      await addWishlistItem(parsed.token, { product_id: product.id })
      window.dispatchEvent(new Event('stella-wishlist-update'))
    } catch (err) {
      console.error(err)
      alert('Unable to add to wishlist')
    }
  }

  const brandOptions = useMemo(() => {
    const set = new Set<string>()
    displayProducts.forEach((product) => {
      if (product.brand) set.add(product.brand)
    })
    return Array.from(set)
  }, [displayProducts])

  const tagOptions = useMemo(() => {
    const set = new Set<string>()
    displayProducts.forEach((product) => {
      ;(product.tags || []).forEach((tag) => set.add(tag))
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [displayProducts])

  const recommendations = useMemo(() => {
    const sorted = [...displayProducts].sort((a, b) => Number(b.avg_rating || 0) - Number(a.avg_rating || 0))
    return sorted.slice(0, 4)
  }, [displayProducts])

  return (
    <main>
      <Hero onCategorySelected={handleCategoryClick} />

      <div className="container" style={{ padding: '4rem 2rem' }}>
        <section style={{ marginBottom: '2rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', background: '#fff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
            <div className="input-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
              <label>Search</label>
              <input
                className="input-field"
                value={searchQuery}
                placeholder="Try laptop, shoes, skincare..."
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Min Price</label>
              <input className="input-field" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Max Price</label>
              <input className="input-field" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="200000" />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Brand</label>
              <select className="input-field" value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)}>
                <option value="">All</option>
                {brandOptions.map((brand) => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Tag</label>
              <select className="input-field" value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
                <option value="">All</option>
                {tagOptions.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Rating</label>
              <select className="input-field" value={rating} onChange={(e) => setRating(e.target.value)}>
                <option value="">Any</option>
                <option value="4">4+ stars</option>
                <option value="3">3+ stars</option>
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Sort</label>
              <select
                className="input-field"
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as 'price_asc' | 'price_desc' | 'popularity' | 'rating' | 'newest'
                  )
                }
              >
                <option value="newest">Newest</option>
                <option value="popularity">Popularity</option>
                <option value="rating">Rating</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', marginTop: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={freeDeliveryOnly} onChange={(e) => setFreeDeliveryOnly(e.target.checked)} />
              Free delivery only
            </label>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-outline" style={{ padding: '10px 16px' }} onClick={clearFilters}>Reset</button>
              <button className="btn-primary" style={{ padding: '10px 16px' }} onClick={() => loadProducts()}>Apply Filters</button>
            </div>
          </div>
        </section>

        {/* Products Section */}
        <section id="products" style={{ marginBottom: '5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
            <div>
              <span className="section-label">Curated For You</span>
              <h2 className="section-heading" style={{ marginBottom: 0 }}>
                {activeCategoryId ? categories.find(c => c.id === activeCategoryId)?.name : "Featured Products"}
              </h2>
            </div>
            {activeCategoryId && (
              <button
                onClick={() => {
                  setActiveCategoryId(null)
                  loadProducts({ category_id: undefined }).catch((err) => console.error(err))
                }}
                className="btn-outline"
                style={{ padding: '10px 24px', fontSize: '0.88rem' }}
              >
                View All
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            {displayProducts.slice(0, 24).map((p) => (
              <ProductCard key={p.id} product={p} isNew={p.id % 5 === 0} onAdd={addToCart} onWishlist={addToWishlist} />
            ))}
            {loading && [...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>

          {displayProducts.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '80px 0', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
              <h2 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>No products found in this category</h2>
              <button className="btn-primary" onClick={clearFilters} style={{ padding: '14px 32px' }}>View All Products</button>
            </div>
          )}
        </section>

        {recommendations.length > 0 && (
          <section style={{ marginBottom: '4rem' }}>
            <span className="section-label">You May Also Like</span>
            <h2 className="section-heading" style={{ marginBottom: '1.5rem' }}>Recommended Products</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem' }}>
              {recommendations.map((product) => (
                <Link key={product.id} href={`/product/${product.id}`} style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '0.75rem', display: 'block' }}>
                  <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '170px', objectFit: 'contain', background: 'var(--bg-soft)', borderRadius: '8px' }} />
                  <p style={{ marginTop: '0.75rem', fontWeight: 600 }}>{product.name}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>Rated {Number(product.avg_rating || 0).toFixed(1)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Features Section */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '4rem' }}>
          {[
            { label: 'Authenticity Ensured', sub: 'All products are 100% genuine with brand warranty.', icon: '🛡️' },
            { label: 'Fast Delivery', sub: 'Free delivery on orders above ₹499. Express available.', icon: '🚚' },
            { label: 'Secure Payments', sub: 'Multiple payment options with end-to-end encryption.', icon: '🔒' }
          ].map((srv, i) => (
            <div key={i} style={{ padding: '2.5rem', background: 'var(--bg-soft)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-light)', transition: 'var(--transition)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{srv.icon}</div>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', fontWeight: 600 }}>{srv.label}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>{srv.sub}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}

function ProductCard({ product, isNew, onAdd, onWishlist }: { product: Product, isNew?: boolean, onAdd: (p: Product) => void, onWishlist: (p: Product) => void }) {
  const colorsSplit = product.colors ? product.colors.split(',').filter(Boolean) : []
  const effectivePrice = Number(product.effective_price || product.price)
  const visibleTags = (product.tags || []).slice(0, 3)

  return (
    <div className="product-card">
      <div className="card-img-box">
        {isNew && <div className="badge badge-new" style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>NEW</div>}
        {Number(product.discount_percent || 0) > 0 && (
          <div className="badge badge-sale" style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
            {Math.floor(Number(product.discount_percent || 0))}% OFF
          </div>
        )}
        <img src={product.image_url} alt={product.name} />
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: 12 }}>
          <button className="btn-outline" style={{ padding: '8px 10px', fontSize: '0.78rem', background: '#fff' }} onClick={() => onWishlist(product)}>Wishlist</button>
        </div>
        <div className="add-btn-float" onClick={() => onAdd(product)}>Add to Cart</div>
      </div>
      <div className="product-info">
        <Link href={`/product/${product.id}`} style={{ fontSize: '0.95rem', marginBottom: '0.4rem', fontWeight: 600, lineHeight: 1.3, display: 'block' }}>{product.name}</Link>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '0.4rem' }}>{product.vendor_store_name || product.vendor_name}</p>

        {visibleTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.5rem' }}>
            {visibleTags.map((tag) => (
              <span key={tag} style={{ fontSize: '0.72rem', border: '1px solid var(--border-light)', borderRadius: '999px', padding: '2px 8px', color: 'var(--text-muted)', background: 'var(--bg-soft)' }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {colorsSplit.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', margin: '0.5rem 0' }}>
            {colorsSplit.slice(0, 5).map((c, idx) => (
              <div
                key={idx}
                style={{ width: '14px', height: '14px', borderRadius: '50%', background: c.trim(), border: '1px solid #DDD' }}
              />
            ))}
          </div>
        )}

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          ⭐ {Number(product.avg_rating || 0).toFixed(1)} ({Number(product.review_count || 0)} reviews)
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="product-price">Rs {Math.floor(effectivePrice).toLocaleString()}</div>
          {Number(product.discount_percent || 0) > 0 && (
            <div style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Rs {Math.floor(Number(product.price)).toLocaleString()}
            </div>
          )}
        </div>

        <div style={{ fontSize: '0.78rem', color: Number(effectivePrice) >= 500 ? 'var(--success)' : 'var(--text-muted)', marginTop: '0.35rem' }}>
          {Number(effectivePrice) >= 500 ? 'Free Delivery' : 'Rs 50 Delivery'}
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="product-card" style={{ opacity: 0.5, pointerEvents: 'none' }}>
      <div className="card-img-box" style={{ background: '#F0F0F0' }}></div>
      <div className="product-info">
        <div style={{ height: '14px', width: '80%', background: '#F0F0F0', borderRadius: '4px', marginBottom: '8px' }}></div>
        <div style={{ height: '14px', width: '40%', background: '#F0F0F0', borderRadius: '4px' }}></div>
      </div>
    </div>
  )
}
