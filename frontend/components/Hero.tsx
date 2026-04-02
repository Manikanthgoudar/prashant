'use client'

import React, { useEffect, useState } from 'react'
import { Category } from '../types'
import { fetchCategories } from '../lib/api'

interface HeroProps {
  onCategorySelected?: (id: number) => void
}

const CATEGORY_IMAGES: Record<string, string> = {
  'Men': 'https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=400&h=300&fit=crop',
  'Women': 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=300&fit=crop',
  'Kids': 'https://images.unsplash.com/photo-1503919005314-30d93d07d823?w=400&h=300&fit=crop',
  'Electronics': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=300&fit=crop',
  'Home & Living': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop',
  'Beauty & Personal Care': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=300&fit=crop',
}

const CATEGORY_SUBTITLES: Record<string, string> = {
  'Men': 'Tops, Bottoms & Footwear',
  'Women': 'Ethnic, Western & Beauty',
  'Kids': 'Clothing, Toys & Daily Care',
  'Electronics': 'Mobiles, Laptops & More',
  'Home & Living': 'Furniture, Kitchen & Decor',
  'Beauty & Personal Care': 'Skincare, Makeup & Haircare',
}

export default function Hero({ onCategorySelected }: HeroProps) {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const cats = await fetchCategories()
        setCategories(cats.filter(c => c.parent_id === null))
      } catch (err) {
        console.error(err)
      }
    }
    loadData()
  }, [])

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="container">
        {/* Hero Banner + Sidebar */}
        <div className="hero-section" style={{ marginBottom: '2.5rem' }}>
          <aside className="category-sidebar">
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
              Collections
            </div>
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="sidebar-link"
                onClick={() => onCategorySelected?.(cat.id)}
              >
                {cat.name}
              </div>
            ))}
          </aside>

          <div className="hero-banner">
            <div className="hero-text">
              <h1 className="hero-title">
                Stella!<br />Everything You Love, Delivered.
              </h1>
              <p className="hero-subtitle">
                Explore 10+ Categories of Premium Products
              </p>
              <div className="hero-actions">
                <a href="#categories" className="btn-primary" style={{ padding: '16px 36px' }}>
                  Explore Now
                </a>
                <a href="#products" className="btn-outline" style={{ padding: '16px 36px' }}>
                  Hot Deals
                </a>
              </div>
            </div>

            <div style={{ position: 'relative', zIndex: 1 }}>
              <img
                src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&h=400&fit=crop"
                alt="Premium shopping"
                style={{ borderRadius: 'var(--radius-md)', width: '380px', height: 'auto', boxShadow: 'var(--shadow-xl)' }}
              />
            </div>
          </div>
        </div>

        {/* Category Cards Grid — like Amazon/ShopEase style */}
        <div id="categories" className="categories-grid">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="category-card"
              onClick={() => onCategorySelected?.(cat.id)}
            >
              <img
                src={CATEGORY_IMAGES[cat.name] || `https://picsum.photos/seed/${cat.name}/400/300`}
                alt={cat.name}
                className="category-card-img"
              />
              <h3>{cat.name}</h3>
              <p>{CATEGORY_SUBTITLES[cat.name] || 'Explore collection'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
