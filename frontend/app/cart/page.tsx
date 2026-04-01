'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import Confetti from 'react-confetti'
import { createOrder } from '@/lib/api'

type CheckoutStep = 'cart' | 'address' | 'payment' | 'confirmation'
type PaymentMethod = 'cod' | 'upi' | 'netbanking'
type UPIApp = 'googlepay' | 'phonepe' | 'paytm' | 'other'
type PaymentStep = 'selection' | 'verification' | 'pin' | 'processing' | 'success'

export default function Cart() {
  const [items, setItems] = useState<any[]>([])
  const [step, setStep] = useState<CheckoutStep>('cart')
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('selection')
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  // Address form
  const [address, setAddress] = useState({
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
  })

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod')
  const [selectedUPI, setSelectedUPI] = useState<UPIApp>('googlepay')
  const [upiId, setUpiId] = useState('')
  const [selectedBank, setSelectedBank] = useState('')
  const [upiPin, setUpiPin] = useState('')

  // Order confirmation
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    const cart = JSON.parse(localStorage.getItem('stella-cart') || '[]')
    setItems(cart)
  }, [])

  const removeItem = (cartId: number) => {
    const updated = items.filter(i => i.cartId !== cartId)
    setItems(updated)
    localStorage.setItem('stella-cart', JSON.stringify(updated))
    window.dispatchEvent(new Event('stella-cart-update'))
  }

  const updateQuantity = (cartId: number, delta: number) => {
    const updated = items.map(item => {
      if (item.cartId === cartId) {
        const newQty = Math.max(1, (item.quantity || 1) + delta)
        return { ...item, quantity: newQty }
      }
      return item
    })
    setItems(updated)
    localStorage.setItem('stella-cart', JSON.stringify(updated))
  }

  const total = items.reduce((acc, i) => acc + (i.finalPrice * (i.quantity || 1)), 0)
  const deliveryCharge = total > 499 ? 0 : 49
  const grandTotal = total + deliveryCharge

  // Calculate delivery date (5-7 days from now)
  const getDeliveryDate = () => {
    const now = new Date()
    const minDate = new Date(now)
    minDate.setDate(now.getDate() + 5)
    const maxDate = new Date(now)
    maxDate.setDate(now.getDate() + 7)
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }
    return {
      min: minDate.toLocaleDateString('en-IN', options),
      max: maxDate.toLocaleDateString('en-IN', options),
      minRaw: minDate,
      maxRaw: maxDate,
    }
  }

  const handleProceedToAddress = () => {
    if (items.length === 0) return
    setStep('address')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault()
    setStep('payment')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleInitiatePayment = () => {
    if (paymentMethod === 'cod') {
      // COD doesn't need modal, go straight to processing
      handlePlaceOrder()
    } else {
      // Open payment modal for UPI/NetBanking
      setShowPaymentModal(true)
      setPaymentStep('verification')
      // Start verification
      setTimeout(() => {
        setPaymentStep('pin')
      }, 1500)
    }
  }

  const handleUPIPinSubmit = () => {
    if (upiPin.length !== 6) {
      alert('Please enter a 6-digit PIN')
      return
    }
    setPaymentStep('processing')
    // Simulate processing
    setTimeout(() => {
      setPaymentStep('success')
      setShowConfetti(true)
      // Auto-close modal and proceed after 2 seconds
      setTimeout(() => {
        setShowPaymentModal(false)
        handlePlaceOrder()
      }, 2000)
    }, 2000)
  }

  const handlePlaceOrder = async () => {
    setIsProcessing(true)
    const delivery = getDeliveryDate()

    // Get user info if logged in
    const userStr = localStorage.getItem('stella-user')
    const userData = userStr ? JSON.parse(userStr) : null
    const token = userData?.token

    try {
      const data = await createOrder({
        userId: userData?.id,
        items: items.map(i => ({
          productId: i.id,
          quantity: i.quantity || 1,
          color: i.selectedColor || null,
        })),
        total_price: grandTotal,
        address,
        payment_method: paymentMethod,
        payment_details: paymentMethod === 'upi' ? selectedUPI : selectedBank,
      }, token)

      setOrderDetails({
        orderId: data.orderId || data.order_id,
        orderDate: data.created_at,
        deliveryMin: delivery.min,
        deliveryMax: delivery.max,
        paymentMethod,
        selectedUPI,
        selectedBank,
        address,
        items: [...items],
        total: grandTotal,
      })
    } catch (err) {
      console.error('Order creation error:', err)
      alert('Failed to place order. Please try again.')
      setIsProcessing(false)
      return
    }

    localStorage.removeItem('stella-cart')
    window.dispatchEvent(new Event('stella-cart-update'))
    setItems([])
    setStep('confirmation')
    setIsProcessing(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const stepLabels = [
    { key: 'cart', label: '1. Cart' },
    { key: 'address', label: '2. Address' },
    { key: 'payment', label: '3. Payment' },
    { key: 'confirmation', label: '4. Confirmation' },
  ]
  const currentStepIndex = stepLabels.findIndex(s => s.key === step)

  return (
    <div className="container" style={{ padding: '2rem 2rem 4rem' }}>
      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => !showConfetti && setShowPaymentModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
            >
              <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden">
                {/* Verification Step */}
                {paymentStep === 'verification' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 text-center">
                    <div className="mb-4 flex justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                        className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
                      />
                    </div>
                    <p className="text-gray-700 font-semibold mb-2">Verifying VPA...</p>
                    <p className="text-sm text-gray-500">{selectedUPI === 'googlepay' ? 'Google Pay' : selectedUPI === 'phonepe' ? 'PhonePe' : 'Paytm'}</p>
                  </motion.div>
                )}

                {/* PIN Entry Step */}
                {paymentStep === 'pin' && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-8">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Enter UPI PIN</h2>
                    <p className="text-sm text-gray-500 mb-6">Confirm your 6-digit UPI PIN to proceed</p>
                    <input
                      type="password"
                      maxLength={6}
                      value={upiPin}
                      onChange={(e) => setUpiPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="•••••• "
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-2xl tracking-widest font-bold focus:outline-none focus:border-blue-500 mb-4"
                    />
                    <p className="text-xs text-gray-500 mb-6">You will not be charged during simulation</p>
                    <button
                      onClick={handleUPIPinSubmit}
                      disabled={upiPin.length !== 6}
                      className="w-full bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors"
                    >
                      Verify & Pay
                    </button>
                  </motion.div>
                )}

                {/* Processing Step */}
                {paymentStep === 'processing' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 text-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                      className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"
                    />
                    <p className="text-gray-700 font-semibold mb-3">Processing Transaction...</p>
                    <motion.div
                      animate={{ opacity: [1, 0.6] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="bg-orange-50 border border-orange-300 rounded-lg p-3 text-left"
                    >
                      <p className="text-sm text-orange-700 font-medium">⚠️ Do not refresh your browser</p>
                    </motion.div>
                  </motion.div>
                )}

                {/* Success Step */}
                {paymentStep === 'success' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 text-center bg-gradient-to-b from-green-50 to-transparent">
                    {showConfetti && <Confetti width={400} height={500} />}
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 100, damping: 12 }}
                      className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-4xl mx-auto mb-4"
                    >
                      ✓
                    </motion.div>
                    <p className="text-lg font-bold text-green-700 mb-2">Transaction Successful!</p>
                    <p className="text-sm text-gray-500">Redirecting to order confirmation...</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Progress Steps */}
      <div className="checkout-steps">
        {stepLabels.map((s, i) => (
          <div
            key={s.key}
            className={`checkout-step ${step === s.key ? 'active' : ''} ${i < currentStepIndex ? 'completed' : ''}`}
          >
            {i < currentStepIndex ? '✓ ' : ''}{s.label}
          </div>
        ))}
      </div>

      {/* ===== STEP 1: CART ===== */}
      {step === 'cart' && (
        <>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '2rem' }}>Your Cart</h1>

          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
              <h2 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '1.2rem' }}>Your cart is empty</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.92rem' }}>Looks like you haven't added anything to your cart yet.</p>
              <Link href="/" className="btn-primary" style={{ padding: '14px 40px' }}>Continue Shopping</Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem', alignItems: 'flex-start' }}>
              {/* Cart Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {items.map((item) => (
                  <div
                    key={item.cartId}
                    style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.25rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: '#fff' }}
                  >
                    <img src={item.image_url} alt={item.name} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', background: 'var(--bg-soft)' }} />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>{item.name}</h3>
                      {item.selectedColor && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          Color: <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{item.selectedColor}</span>
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '0.5rem' }}>
                        <button onClick={() => updateQuantity(item.cartId, -1)} style={{ width: '28px', height: '28px', border: '1px solid var(--border)', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{item.quantity || 1}</span>
                        <button onClick={() => updateQuantity(item.cartId, 1)} style={{ width: '28px', height: '28px', border: '1px solid var(--border)', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--accent)' }}>₹{Math.floor(item.finalPrice * (item.quantity || 1)).toLocaleString()}</div>
                      <button
                        onClick={() => removeItem(item.cartId)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.82rem', fontWeight: 500, marginTop: '0.5rem' }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '2rem', background: '#fff', position: 'sticky', top: '100px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>Order Summary</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.92rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal ({items.length} items)</span>
                  <span style={{ fontWeight: 600 }}>₹{Math.floor(total).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.92rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Delivery</span>
                  <span style={{ fontWeight: 600, color: deliveryCharge === 0 ? 'var(--success)' : 'var(--text-main)' }}>
                    {deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}
                  </span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-light)', margin: '1rem 0', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700 }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--accent)' }}>₹{Math.floor(grandTotal).toLocaleString()}</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  📦 Estimated delivery: {getDeliveryDate().min}
                </p>
                <button className="btn-primary" style={{ width: '100%', padding: '14px' }} onClick={handleProceedToAddress}>
                  Proceed to Checkout
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== STEP 2: ADDRESS ===== */}
      {step === 'address' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <button onClick={() => setStep('cart')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-secondary)' }}>←</button>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Delivery Address</h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem', alignItems: 'flex-start' }}>
            <form onSubmit={handleProceedToPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Full Name *</label>
                  <input className="input-field" required value={address.fullName} onChange={(e) => setAddress({ ...address, fullName: e.target.value })} placeholder="John Doe" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Phone Number *</label>
                  <input className="input-field" required type="tel" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Address Line 1 *</label>
                <input className="input-field" required value={address.addressLine1} onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })} placeholder="House no., Building, Street" />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Address Line 2</label>
                <input className="input-field" value={address.addressLine2} onChange={(e) => setAddress({ ...address, addressLine2: e.target.value })} placeholder="Landmark, Area (optional)" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>City *</label>
                  <input className="input-field" required value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} placeholder="Mumbai" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>State *</label>
                  <input className="input-field" required value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} placeholder="Maharashtra" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Pincode *</label>
                  <input className="input-field" required value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value })} placeholder="400001" />
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '1rem', padding: '14px 32px', alignSelf: 'flex-start' }}>
                Continue to Payment →
              </button>
            </form>

            {/* Mini summary */}
            <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1.5rem', background: '#fff', position: 'sticky', top: '100px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Order Summary</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{items.length} item(s)</p>
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent)' }}>₹{Math.floor(grandTotal).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== STEP 3: PAYMENT ===== */}
      {step === 'payment' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <button onClick={() => setStep('address')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-secondary)' }}>←</button>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Payment Method</h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem', alignItems: 'flex-start' }}>
            <div>
              {/* Cash on Delivery */}
              <div
                className={`payment-option ${paymentMethod === 'cod' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('cod')}
              >
                <input type="radio" name="payment" checked={paymentMethod === 'cod'} readOnly />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>💵 Cash on Delivery</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>Pay when your order arrives at your doorstep</p>
                </div>
              </div>

              {/* UPI */}
              <div
                className={`payment-option ${paymentMethod === 'upi' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('upi')}
                style={{ flexDirection: 'column', alignItems: 'flex-start' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
                  <input type="radio" name="payment" checked={paymentMethod === 'upi'} readOnly />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>📱 UPI Payment</div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>Pay using Google Pay, PhonePe, Paytm or any UPI app</p>
                  </div>
                </div>

                {paymentMethod === 'upi' && (
                  <div style={{ width: '100%', paddingTop: '1rem', borderTop: '1px solid var(--border-light)', marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Select UPI App:</p>
                    <div className="upi-apps">
                      {([
                        { key: 'googlepay' as UPIApp, name: 'Google Pay', color: '#4285F4', letter: 'G' },
                        { key: 'phonepe' as UPIApp, name: 'PhonePe', color: '#5F259F', letter: 'P' },
                        { key: 'paytm' as UPIApp, name: 'Paytm', color: '#00BAF2', letter: 'P' },
                      ]).map(app => (
                        <div
                          key={app.key}
                          className={`upi-app ${selectedUPI === app.key ? 'selected' : ''}`}
                          onClick={(e) => { e.stopPropagation(); setSelectedUPI(app.key) }}
                        >
                          <div className="upi-app-icon" style={{ background: app.color }}>{app.letter}</div>
                          {app.name}
                        </div>
                      ))}
                    </div>
                    <div className="input-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                      <label>UPI ID (optional)</label>
                      <input
                        className="input-field"
                        placeholder="yourname@upi"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Net Banking */}
              <div
                className={`payment-option ${paymentMethod === 'netbanking' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('netbanking')}
                style={{ flexDirection: 'column', alignItems: 'flex-start' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
                  <input type="radio" name="payment" checked={paymentMethod === 'netbanking'} readOnly />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>🏦 Net Banking</div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>Pay directly from your bank account</p>
                  </div>
                </div>

                {paymentMethod === 'netbanking' && (
                  <div style={{ width: '100%', paddingTop: '1rem', borderTop: '1px solid var(--border-light)', marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Select Bank:</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      {['SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Bank', 'Bank of Baroda'].map(bank => (
                        <div
                          key={bank}
                          className={`upi-app ${selectedBank === bank ? 'selected' : ''}`}
                          onClick={(e) => { e.stopPropagation(); setSelectedBank(bank) }}
                          style={{ flexDirection: 'row', padding: '10px 14px' }}
                        >
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)' }}>
                            {bank.charAt(0)}
                          </div>
                          <span style={{ fontSize: '0.85rem' }}>{bank}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                className="btn-primary"
                style={{ marginTop: '1.5rem', padding: '16px 40px' }}
                onClick={handleInitiatePayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '18px', height: '18px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }}></span>
                    Placing Order...
                  </span>
                ) : `Place Order — ₹${Math.floor(grandTotal).toLocaleString()}`}
              </button>

              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>

            {/* Summary sidebar */}
            <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1.5rem', background: '#fff', position: 'sticky', top: '100px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Delivery Address</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <strong>{address.fullName}</strong><br />
                {address.addressLine1}<br />
                {address.addressLine2 && <>{address.addressLine2}<br /></>}
                {address.city}, {address.state} - {address.pincode}<br />
                📞 {address.phone}
              </p>
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{items.length} item(s)</span>
                  <span style={{ fontWeight: 600 }}>₹{Math.floor(total).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Delivery</span>
                  <span style={{ fontWeight: 600, color: deliveryCharge === 0 ? 'var(--success)' : undefined }}>{deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem' }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--accent)' }}>₹{Math.floor(grandTotal).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== STEP 4: ORDER CONFIRMATION ===== */}
      {step === 'confirmation' && orderDetails && (
        <div className="order-success">
          <div className="order-success-icon">✓</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--accent)' }}>Order Placed Successfully!</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '0.5rem' }}>
            Thank you for shopping with Stella!
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Order ID: <strong style={{ color: 'var(--text-main)' }}>{orderDetails.orderId}</strong>
          </p>

          <div className="order-details-card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📦 Order Details</h3>
            <div className="order-detail-row">
              <span style={{ color: 'var(--text-secondary)' }}>Order Date</span>
              <span style={{ fontWeight: 600 }}>{orderDetails.orderDate}</span>
            </div>
            <div className="order-detail-row">
              <span style={{ color: 'var(--text-secondary)' }}>Estimated Delivery</span>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{orderDetails.deliveryMin} — {orderDetails.deliveryMax}</span>
            </div>
            <div className="order-detail-row">
              <span style={{ color: 'var(--text-secondary)' }}>Payment Method</span>
              <span style={{ fontWeight: 600 }}>
                {orderDetails.paymentMethod === 'cod' && '💵 Cash on Delivery'}
                {orderDetails.paymentMethod === 'upi' && `📱 UPI (${orderDetails.selectedUPI === 'googlepay' ? 'Google Pay' : orderDetails.selectedUPI === 'phonepe' ? 'PhonePe' : 'Paytm'})`}
                {orderDetails.paymentMethod === 'netbanking' && `🏦 Net Banking (${orderDetails.selectedBank})`}
              </span>
            </div>
            <div className="order-detail-row">
              <span style={{ color: 'var(--text-secondary)' }}>Delivery Address</span>
              <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '200px' }}>
                {orderDetails.address.addressLine1}, {orderDetails.address.city}
              </span>
            </div>
            <div className="order-detail-row" style={{ borderBottom: 'none' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Amount</span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent)' }}>₹{Math.floor(orderDetails.total).toLocaleString()}</span>
            </div>
          </div>

          {/* Items ordered */}
          <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Items Ordered ({orderDetails.items.length})</h3>
            {orderDetails.items.map((item: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-soft)', marginBottom: '0.5rem' }}>
                <img src={item.image_url} alt={item.name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600 }}>{item.name}</p>
                </div>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>₹{Math.floor(item.finalPrice).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <Link href="/" className="btn-primary" style={{ padding: '14px 48px' }}>Continue Shopping</Link>
        </div>
      )}
    </div>
  )
}

