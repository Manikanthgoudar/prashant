 'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Category, Product } from '../types'
import { fetchCategories, fetchProducts, fetchCategoryProducts } from '../lib/api'
import Hero from '../components/Hero'

export const dynamic = 'force-dynamic'

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [displayProducts, setDisplayProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Use router to get search params instead of useSearchParams hook
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q')
    setSearchQuery(q)
  }, [])

  useEffect(() => {
    async function loadData() {
      try {
        const [cats, prods] = await Promise.all([
          fetchCategories(),
          fetchProducts()
        ])
        setCategories(cats)
        setAllProducts(prods)
        setDisplayProducts(prods)
      } catch (err) {
        console.error("The Stella backend seems offline.", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // handle search query from URL
  useEffect(() => {
    if (searchQuery) {
      setLoading(true)
      fetchProducts(undefined, searchQuery).then(res => {
        setDisplayProducts(res)
        setActiveCategoryId(null)
      }).catch(err => console.error(err)).finally(() => setLoading(false))
    }
  }, [searchQuery])

  const handleCategoryClick = async (id: number) => {
    setLoading(true)
    setActiveCategoryId(id)
    try {
      const catProducts = await fetchCategoryProducts(id)
      setDisplayProducts(catProducts)
      document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth' })
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (product: Product, selection: { color: string, price: number }) => {
    const existing = JSON.parse(localStorage.getItem('stella-cart') || '[]')
    const newItem = { ...product, selectedColor: selection.color, finalPrice: selection.price, cartId: Date.now() }
    localStorage.setItem('stella-cart', JSON.stringify([...existing, newItem]))
    window.dispatchEvent(new Event('stella-cart-update'))
    // navigate to cart for a smoother conversion flow
    router.push('/cart')
  }

  return (
    <main>
      <Hero onCategorySelected={handleCategoryClick} />
      
      <div className="container" style={{ padding: '4rem 2rem' }}>
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
                onClick={() => { setActiveCategoryId(null); setDisplayProducts(allProducts); }}
                className="btn-outline"
                style={{ padding: '10px 24px', fontSize: '0.88rem' }}
              >
                View All
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            {(displayProducts.length > 0 ? displayProducts : allProducts).slice(0, 20).map((p) => (
              <ProductCard key={p.id} product={p} isNew={p.id % 5 === 0} onAdd={addToCart} />
            ))}
            {loading && [...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
          
          {displayProducts.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '80px 0', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
              <h2 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>No products found in this category</h2>
              <button className="btn-primary" onClick={() => { setActiveCategoryId(null); setDisplayProducts(allProducts); }} style={{ padding: '14px 32px' }}>View All Products</button>
            </div>
          )}
        </section>

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

function ProductCard({ product, isNew, onAdd }: { product: Product, isNew?: boolean, onAdd: (p: Product, s: { color: string, price: number }) => void }) {
  const [selectedColor, setSelectedColor] = useState('')
  const [priceModifier, setPriceModifier] = useState(0)

  const colorsSplit = product.colors ? product.colors.split(',') : []

  useEffect(() => {
    if (colorsSplit.length > 0 && !selectedColor) {
      setSelectedColor(colorsSplit[0])
    }
  }, [product])

  const handleColorChange = (color: string, index: number) => {
    setSelectedColor(color)
    setPriceModifier(index * (product.price * 0.1))
  }

  const finalPrice = product.price + priceModifier

  return (
    <div className="product-card">
      <div className="card-img-box">
        {isNew && <div className="badge badge-new" style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>NEW</div>}
        <img src={product.image_url} alt={product.name} />
        <div className="add-btn-float" onClick={() => onAdd(product, { color: selectedColor, price: finalPrice })}>Add to Cart</div>
      </div>
      <div className="product-info">
        <h3 style={{ fontSize: '0.95rem', marginBottom: '0.4rem', fontWeight: 600, lineHeight: 1.3 }}>{product.name}</h3>
        
        {colorsSplit.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', margin: '0.5rem 0' }}>
            {colorsSplit.map((c, idx) => (
              <div
                key={idx} onClick={() => handleColorChange(c, idx)}
                style={{ width: '14px', height: '14px', borderRadius: '50%', background: c.trim(), cursor: 'pointer', border: selectedColor === c ? '2px solid var(--accent)' : '1px solid #DDD', transition: 'var(--transition-fast)' }}
              />
            ))}
          </div>
        )}

        <div className="product-price">
          ₹{Math.floor(finalPrice).toLocaleString()}
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
