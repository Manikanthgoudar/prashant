'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { loginUser, loginWithGoogle, sendAuthOtp, signupUser, verifyAuthOtp } from '@/lib/api'

type AuthMethod = 'password' | 'otp'

type SessionUser = {
  id: number
  name: string
  email: string
  role: 'admin' | 'vendor' | 'customer'
  store_name?: string | null
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string
            callback: (response: { credential?: string }) => void
          }) => void
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black'
              size?: 'large' | 'medium' | 'small'
              text?: string
              shape?: 'pill' | 'rectangular' | 'square' | 'circle'
              width?: number
            }
          ) => void
        }
      }
    }
  }
}

export default function Signup() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(false)
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password')
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'customer', storeName: '' })
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [otpMessage, setOtpMessage] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const googleBtnRef = useRef<HTMLDivElement | null>(null)

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  const completeSession = useCallback((user: SessionUser, token: string) => {
    localStorage.setItem(
      'stella-user',
      JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        token,
        role: user.role,
        store_name: user.store_name || null
      })
    )
    window.dispatchEvent(new Event('stella-user-update'))
    setSuccess(true)
    setTimeout(() => {
      if (user.role === 'admin') router.push('/admin')
      else if (user.role === 'vendor') router.push('/vendor')
      else router.push('/')
    }, 400)
  }, [router])

  const handleGoogleAuth = useCallback(async (idToken: string) => {
    setErrorMessage('')
    setGoogleLoading(true)
    try {
      const data = await loginWithGoogle(idToken)
      completeSession(data.user, data.token)
    } catch (err: any) {
      setErrorMessage(err.message || 'Google authentication failed')
    } finally {
      setGoogleLoading(false)
    }
  }, [completeSession])

  useEffect(() => {
    if (!googleReady || !googleClientId || !window.google?.accounts?.id || !googleBtnRef.current) return

    googleBtnRef.current.innerHTML = ''
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response: { credential?: string }) => {
        const credential = response?.credential || ''
        if (!credential) return
        handleGoogleAuth(credential).catch((err) => console.error(err))
      }
    })

    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 360
    })
  }, [googleReady, googleClientId, handleGoogleAuth])

  const handleSendOtp = async () => {
    setErrorMessage('')
    setOtpMessage('')

    if (!formData.email) {
      setErrorMessage('Please enter your email first')
      return
    }

    if (!isLogin) {
      if (!formData.name) {
        setErrorMessage('Please enter your name first')
        return
      }
      if (!formData.password || formData.password.length < 6) {
        setErrorMessage('Please enter a password with at least 6 characters')
        return
      }
      if (formData.role === 'vendor' && !formData.storeName.trim()) {
        setErrorMessage('Please enter your store name')
        return
      }
    }

    setOtpSending(true)
    try {
      await sendAuthOtp(formData.email, isLogin ? 'login' : 'signup')
      setOtpSent(true)
      setOtpMessage('OTP sent to your email')
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send OTP')
    } finally {
      setOtpSending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (authMethod === 'otp') {
      if (!otpSent) {
        setErrorMessage('Send OTP first, then verify it')
        return
      }
      if (!otpValue.trim()) {
        setErrorMessage('Enter OTP from your email')
        return
      }
    } else if (!formData.email || !formData.password) {
      return
    }

    setLoading(true)

    try {
      if (authMethod === 'otp') {
        const data = await verifyAuthOtp({
          email: formData.email,
          otp: otpValue,
          purpose: isLogin ? 'login' : 'signup',
          ...(isLogin
            ? {}
            : {
              name: formData.name,
              password: formData.password,
              role: formData.role as 'customer' | 'vendor' | 'admin',
              storeName: formData.storeName
            })
        })

        completeSession(data.user, data.token)
      } else {
        if (isLogin) {
          const data = await loginUser(formData.email, formData.password)
          completeSession(data.user, data.token)
        } else {
          const data = await signupUser(
            formData.name,
            formData.email,
            formData.password,
            formData.role as 'customer' | 'vendor' | 'admin',
            formData.storeName
          )
          completeSession(data.user, data.token)
        }
      }
    } catch (err: any) {
      console.error(err)
      setErrorMessage(err.message || (isLogin ? 'Login failed' : 'Signup failed'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '120px 2rem' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', fontSize: '2.5rem' }}>
            ✓
          </div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 700 }}>Welcome to Stella!</h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>
            Your account is ready. Redirecting to your dashboard...
          </p>
          <Link href="/" className="btn-primary" style={{ padding: '16px 48px' }}>Start Shopping</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '100vw', overflow: 'hidden' }}>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGoogleReady(true)}
      />

      <div className="auth-container">
        <div className="auth-image-box">
          <img
            src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1000&auto=format&fit=crop"
            alt="Stella Shopping"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(74,124,89,0.85) 0%, rgba(35,47,62,0.9) 100%)' }}></div>
          <div style={{ position: 'absolute', bottom: '12%', left: '10%', right: '10%', color: '#fff' }}>
            <h2 style={{ fontSize: '2.8rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.15 }}>
              {isLogin ? 'Welcome Back!' : 'Build Your Marketplace Identity.'}
            </h2>
            <p style={{ fontSize: '1.15rem', opacity: 0.85, lineHeight: 1.6 }}>
              {isLogin
                ? 'Sign in to continue shopping, managing store operations, or reviewing platform analytics.'
                : 'Register as a customer or vendor. Vendors can start listing products immediately with auto split-commission tracking.'}
            </p>
          </div>
          <div style={{ position: 'absolute', top: '10%', right: '10%', width: '120px', height: '120px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)' }}></div>
          <div style={{ position: 'absolute', top: '25%', right: '20%', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }}></div>
        </div>

        <div className="auth-form-box">
          <div style={{ maxWidth: '420px', width: '100%' }}>
            <div style={{ marginBottom: '2.5rem' }}>
              <Link href="/" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>Stella!</Link>
            </div>

            <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              {isLogin ? 'Sign In' : 'Create Account'}
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.95rem' }}>
              {isLogin ? 'Enter your credentials to continue' : 'Fill in your details to get started'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setAuthMethod('password')}
                className={authMethod === 'password' ? 'btn-primary' : 'btn-outline'}
                style={{ padding: '10px 12px', borderRadius: '8px' }}
              >
                Password Auth
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod('otp')}
                className={authMethod === 'otp' ? 'btn-primary' : 'btn-outline'}
                style={{ padding: '10px 12px', borderRadius: '8px' }}
              >
                OTP Auth
              </button>
            </div>

            {errorMessage && (
              <div style={{ marginBottom: '1rem', background: '#fff2f2', color: '#9f1239', border: '1px solid #fecdd3', padding: '10px 12px', borderRadius: '8px', fontSize: '0.88rem' }}>
                {errorMessage}
              </div>
            )}

            {otpMessage && (
              <div style={{ marginBottom: '1rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: '8px', fontSize: '0.88rem' }}>
                {otpMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
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

              {!isLogin && (
                <div className="input-group">
                  <label>Register As</label>
                  <select
                    className="input-field"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="customer">Customer</option>
                    <option value="vendor">Vendor / Seller</option>
                  </select>
                </div>
              )}

              {!isLogin && formData.role === 'vendor' && (
                <div className="input-group">
                  <label>Store Name</label>
                  <input
                    type="text"
                    placeholder="My Awesome Store"
                    className="input-field"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    required
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
                    required={!isLogin || authMethod === 'password'}
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

              {authMethod === 'otp' && (
                <>
                  <div className="input-group">
                    <label>One-Time Password</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      placeholder="Enter OTP"
                      className="input-field"
                      value={otpValue}
                      onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                      required={authMethod === 'otp'}
                    />
                  </div>

                  <button
                    type="button"
                    disabled={otpSending || loading}
                    className="btn-outline"
                    onClick={handleSendOtp}
                    style={{ marginTop: '0.25rem', marginBottom: '0.75rem', padding: '12px', borderRadius: 'var(--radius-sm)' }}
                  >
                    {otpSending ? 'Sending OTP...' : otpSent ? 'Resend OTP' : 'Send OTP'}
                  </button>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ marginTop: isLogin ? '0' : '0.5rem', padding: '15px', borderRadius: 'var(--radius-sm)', fontSize: '1rem', opacity: loading ? 0.8 : 1 }}
              >
                {loading
                  ? 'Please wait...'
                  : authMethod === 'otp'
                    ? isLogin
                      ? 'Verify OTP & Sign In →'
                      : 'Verify OTP & Create Account →'
                    : isLogin
                      ? 'Sign In →'
                      : 'Create Account →'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
              <div style={{ height: '1px', background: 'var(--border)', flex: 1 }}></div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>OR</span>
              <div style={{ height: '1px', background: 'var(--border)', flex: 1 }}></div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              {googleClientId ? (
                <div style={{ opacity: googleLoading ? 0.7 : 1 }}>
                  <div ref={googleBtnRef} />
                </div>
              ) : (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Google sign-in is disabled. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID in .env.
                </p>
              )}
            </div>

            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem', fontSize: '0.92rem' }}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setErrorMessage('')
                  setOtpMessage('')
                  setOtpSent(false)
                  setOtpValue('')
                }}
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
