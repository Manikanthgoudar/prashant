'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchCart, fetchWishlist } from '@/lib/api'

type SessionUser = {
  id: number
  name: string
  email: string
  token: string
  role: 'admin' | 'vendor' | 'customer'
  store_name?: string | null
}

export default function Navbar() {
  const [cartCount, setCartCount] = useState(0)
  const [wishlistCount, setWishlistCount] = useState(0)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  const getInitials = (name?: string) => {
    if (!name) return '👤'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getAvatarColor = (email?: string) => {
    if (!email) return 'bg-gray-400'
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500']
    const index = email.charCodeAt(0) % colors.length
    return colors[index]
  }

  useEffect(() => {
    const loadSession = async () => {
      const userText = localStorage.getItem('stella-user')
      const parsed = userText ? JSON.parse(userText) : null
      setUser(parsed)

      const localCart = JSON.parse(localStorage.getItem('stella-cart') || '[]')
      const localWishlist = JSON.parse(localStorage.getItem('stella-wishlist') || '[]')

      if (!parsed?.token) {
        setCartCount(localCart.length)
        setWishlistCount(localWishlist.length)
        return
      }

      try {
        const [cartRes, wishlistRes] = await Promise.all([
          fetchCart(parsed.token),
          fetchWishlist(parsed.token)
        ])
        setCartCount((cartRes.items || []).length)
        setWishlistCount((wishlistRes.items || []).length)
      } catch {
        setCartCount(localCart.length)
        setWishlistCount(localWishlist.length)
      }
    }

    const refreshSession = () => {
      loadSession().catch(() => undefined)
    }

    refreshSession()
    window.addEventListener('stella-cart-update', refreshSession)
    window.addEventListener('stella-user-update', refreshSession)
    window.addEventListener('stella-wishlist-update', refreshSession)

    return () => {
      window.removeEventListener('stella-cart-update', refreshSession)
      window.removeEventListener('stella-user-update', refreshSession)
      window.removeEventListener('stella-wishlist-update', refreshSession)
    }
  }, [])

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const q = String(fd.get('q') || '').trim()
    if (!q) return
    router.push(`/?q=${encodeURIComponent(q)}`)
  }

  const handleLogout = () => {
    localStorage.removeItem('stella-user')
    localStorage.removeItem('stella-cart')
    window.dispatchEvent(new Event('stella-user-update'))
    setMenuOpen(false)
    router.push('/')
  }

  const dashboardLink = user?.role === 'admin' ? '/admin' : user?.role === 'vendor' ? '/vendor' : '/user'
  const dashboardLabel = user?.role === 'admin' ? 'Admin Dashboard' : user?.role === 'vendor' ? 'Vendor Dashboard' : 'User Dashboard'

  return (
    <>
      <div className="top-announcement">
        <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px' }}>
          <span>Marketplace Live: Multi-vendor onboarding is instant</span>
          <Link href="/" style={{ color: '#B08D57', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '2px' }}>
            Explore Products
          </Link>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>Flat Rs 50 delivery below Rs 500, free above threshold</span>
        </div>
      </div>

      <header>
        <div className="container">
          <nav className="nav-main">
            <Link href="/" className="logo">
              Stella!
            </Link>

            <div className="nav-links">
              <Link href="/" className="nav-link active">Home</Link>
              {user?.role === 'vendor' && <Link href="/vendor" className="nav-link">Vendor</Link>}
              {user?.role === 'admin' && <Link href="/admin" className="nav-link">Admin</Link>}
              <Link href="/about" className="nav-link">About</Link>
              <Link href="/contact" className="nav-link">Contact</Link>
              {!user && <Link href="/signup" className="nav-link">Sign Up</Link>}
            </div>

            <div className="nav-actions">
              <form className="search-pill" onSubmit={handleSearch} style={{ display: 'flex' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input name="q" type="text" placeholder="Search products..." />
              </form>

              <Link href="/cart" className="action-icon" style={{ textDecoration: 'none' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                {cartCount > 0 && <div className="cart-count">{cartCount}</div>}
              </Link>

              <Link href="/profile" className="action-icon" style={{ textDecoration: 'none' }} title="Wishlist">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                {wishlistCount > 0 && <div className="cart-count">{wishlistCount}</div>}
              </Link>

              <div style={{ position: 'relative' }}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setMenuOpen(!menuOpen)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {user ? (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${getAvatarColor(user.email)}`}>
                      {getInitials(user.name)}
                    </div>
                  ) : (
                    <div className="action-icon">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                  )}
                </motion.button>

                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -8 }}
                      style={{ position: 'absolute', right: 0, marginTop: '8px', background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-md)', minWidth: '240px', zIndex: 50 }}
                    >
                      {user ? (
                        <div>
                          {/* User Profile Header */}
                          <div style={{ padding: '16px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base ${getAvatarColor(user.email)}`}>
                              {getInitials(user.name)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{user.name}</div>
                              <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>{user.email}</div>
                              <div style={{ fontSize: '0.72rem', opacity: 0.9, textTransform: 'capitalize' }}>{user.role}</div>
                            </div>
                          </div>

                          {/* Menu Items */}
                          <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
                            <Link
                              href={dashboardLink}
                              onClick={() => setMenuOpen(false)}
                              style={{ padding: '12px 16px', color: 'var(--text-main)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', borderBottom: '1px solid var(--border-light)', transition: 'background-color 0.2s' }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-soft)')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <span>📊</span> {dashboardLabel}
                            </Link>
                            <Link
                              href="/profile"
                              onClick={() => setMenuOpen(false)}
                              style={{ padding: '12px 16px', color: 'var(--text-main)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', borderBottom: '1px solid var(--border-light)', transition: 'background-color 0.2s' }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-soft)')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <span>🧾</span> Orders & Wishlist
                            </Link>
                            <button
                              onClick={handleLogout}
                              style={{ padding: '12px 16px', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background-color 0.2s' }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-soft)')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <span>🚪</span> Sign Out
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '16px' }}>
                          <Link href="/signup" className="btn-primary" onClick={() => setMenuOpen(false)} style={{ padding: '12px 16px', display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                            Sign In / Sign Up
                          </Link>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </nav>
        </div>
      </header>
    </>
  )
}
