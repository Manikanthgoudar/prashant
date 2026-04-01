'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

// Removed demo accounts - user will enter their own

export default function Signup() {
  const [isLogin, setIsLogin] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', password: '' })
  const [success, setSuccess] = useState(false)
  const [showGooglePicker, setShowGooglePicker] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [googleEmail, setGoogleEmail] = useState('')
  const [googlePassword, setGooglePassword] = useState('')
  const [googleStep, setGoogleStep] = useState<'email' | 'password'>('email')
  const [googleLoading2, setGoogleLoading2] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.password) return
    if (isLogin) {
      // login flow
      fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password })
      }).then(async (res) => {
        if (!res.ok) throw new Error('Login failed')
        const data = await res.json()
        if (data.token) {
          localStorage.setItem('stella-user', JSON.stringify({ name: data.user.name, email: data.user.email, token: data.token }))
          window.dispatchEvent(new Event('stella-user-update'))
        }
        setSuccess(true)
      }).catch(err => { console.error(err); alert('Login failed') })
    } else {
      // signup
      fetch('http://localhost:8000/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, email: formData.email, password: formData.password })
      }).then(async (res) => {
        if (!res.ok) throw new Error('Signup failed')
        const data = await res.json()
        // store user info + token
        if (data.token) {
          localStorage.setItem('stella-user', JSON.stringify({ name: data.user.name, email: data.user.email, token: data.token }))
          window.dispatchEvent(new Event('stella-user-update'))
        } else {
          localStorage.setItem('stella-user', JSON.stringify({ name: formData.name, email: formData.email }))
          window.dispatchEvent(new Event('stella-user-update'))
        }
        setSuccess(true)
      }).catch(err => { console.error(err); alert('Signup failed') })
    }
  }

  const handleGoogleSignIn = () => {
    setShowGooglePicker(true)
    setGoogleStep('email')
    setGoogleEmail('')
    setGooglePassword('')
  }

  const handleGoogleEmailSubmit = () => {
    if (!googleEmail) return
    setGoogleStep('password')
    setGooglePassword('')
  }

  const handleGooglePasswordSubmit = () => {
    if (!googlePassword) return
    setGoogleLoading2(true)
    setTimeout(() => {
      setGoogleLoading2(false)
      setShowGooglePicker(false)
      setGoogleStep('email')
      setGoogleEmail('')
      setGooglePassword('')
      // Extract name from email
      const name = googleEmail.split('@')[0].replace(/[._]/g, ' ')
      localStorage.setItem('stella-user', JSON.stringify({ 
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: googleEmail,
        providers: ['google']
      }))
      window.dispatchEvent(new Event('stella-user-update'))
      setSuccess(true)
    }, 1500)
  }

  if (success) {
    return (
      <motion.div 
        className="container" 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ textAlign: 'center', padding: '120px 2rem' }}
      >
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <motion.div 
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 12 }}
            style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', fontSize: '2.5rem' }}
          >
            ✓
          </motion.div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 700 }}>Welcome to Stella!</h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>Your account has been created successfully. Start exploring our premium collection.</p>
          <Link href="/" className="btn-primary" style={{ padding: '16px 48px' }}>Start Shopping</Link>
        </div>
      </motion.div>
    )
  }

  return (
    <div style={{ maxWidth: '100vw', overflow: 'hidden' }}>
      {/* Google Account Picker Modal */}
      <AnimatePresence>
        {showGooglePicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setShowGooglePicker(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
            >
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-8 text-white">
                  <svg className="w-8 h-8 mb-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <h2 className="text-2xl font-bold">{googleStep === 'email' ? 'Sign in with Google' : 'Enter Password'}</h2>
                  <p className="text-blue-100 text-sm mt-1">to continue with Stella</p>
                </div>

                {!googleLoading2 ? (
                  <div className="p-8">
                    {googleStep === 'email' ? (
                      <>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Google Email</label>
                        <input
                          type="email"
                          placeholder="you@gmail.com"
                          value={googleEmail}
                          onChange={(e) => setGoogleEmail(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleGoogleEmailSubmit()}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mb-6"
                          autoFocus
                        />
                        <button
                          onClick={handleGoogleEmailSubmit}
                          disabled={!googleEmail}
                          className="w-full bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors hover:bg-blue-700"
                        >
                          Next
                        </button>
                        <button
                          onClick={() => setShowGooglePicker(false)}
                          className="w-full mt-2 text-gray-600 font-medium py-2 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="bg-gray-100 rounded-lg p-4 mb-6">
                          <p className="text-sm text-gray-600">Signing in as</p>
                          <p className="font-semibold text-gray-800">{googleEmail}</p>
                        </div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Password</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={googlePassword}
                          onChange={(e) => setGooglePassword(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleGooglePasswordSubmit()}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 mb-6"
                          autoFocus
                        />
                        <button
                          onClick={handleGooglePasswordSubmit}
                          disabled={!googlePassword}
                          className="w-full bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors hover:bg-blue-700"
                        >
                          Sign In
                        </button>
                        <button
                          onClick={() => setGoogleStep('email')}
                          className="w-full mt-2 text-gray-600 font-medium py-2 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          Back
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-8 text-center"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                      className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
                    />
                    <p className="text-gray-700 font-semibold">Verifying...</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="auth-container">
        {/* Left Side — Decorative */}
        <div className="auth-image-box">
          <img
            src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1000&auto=format&fit=crop"
            alt="Stella Shopping"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(74,124,89,0.85) 0%, rgba(35,47,62,0.9) 100%)' }}></div>
          <div style={{ position: 'absolute', bottom: '12%', left: '10%', right: '10%', color: '#fff' }}>
            <h2 style={{ fontSize: '2.8rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.15 }}>
              {isLogin ? 'Welcome Back!' : 'Join Stella Today.'}
            </h2>
            <p style={{ fontSize: '1.15rem', opacity: 0.85, lineHeight: 1.6 }}>
              {isLogin ? 'Sign in to access your orders, wishlist and personalized recommendations.' : 'Create your free account and discover everything you love, delivered right to your doorstep.'}
            </p>
          </div>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: '10%', right: '10%', width: '120px', height: '120px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)' }}></div>
          <div style={{ position: 'absolute', top: '25%', right: '20%', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }}></div>
        </div>

        {/* Right Side — Form */}
        <div className="auth-form-box">
          <div style={{ maxWidth: '420px', width: '100%' }}>
            {/* Logo */}
            <div style={{ marginBottom: '2.5rem' }}>
              <Link href="/" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>Stella!</Link>
            </div>

            <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              {isLogin ? 'Sign In' : 'Create Account'}
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.95rem' }}>
              {isLogin ? 'Enter your credentials to continue' : 'Fill in your details to get started'}
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {/* Name field - only for signup */}
              {!isLogin && (
                <div className="input-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    className="input-field"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required={!isLogin}
                  />
                </div>
              )}

              <div className="input-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="input-field"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="input-group">
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input-field"
                    style={{ paddingRight: '48px' }}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Forgot password / Remember me — login mode */}
              {isLogin && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.5rem 0 1.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ accentColor: 'var(--accent)', width: '16px', height: '16px' }} />
                    Remember me
                  </label>
                  <a href="#" style={{ fontSize: '0.88rem', color: 'var(--accent)', fontWeight: 600 }}>Forgot Password?</a>
                </div>
              )}

              <button type="submit" className="btn-primary" style={{ marginTop: isLogin ? '0' : '0.5rem', padding: '15px', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }}>
                {isLogin ? 'Sign In →' : 'Create Account →'}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.75rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 500 }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              style={{
                width: '100%',
                padding: '14px',
                background: '#fff',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: 'var(--text-main)',
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4285F4'; e.currentTarget.style.background = '#F8F9FF' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = '#fff' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            {/* Toggle login/signup */}
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem', fontSize: '0.92rem' }}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: '0.92rem', textDecoration: 'underline', textUnderlineOffset: '2px' }}
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
