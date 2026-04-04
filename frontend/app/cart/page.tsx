'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  addWishlistItem,
  clearCart,
  createOrder,
  fetchAddresses,
  fetchCart,
  getPaymentOptions,
  removeCartItem,
  saveAddress,
  setDefaultAddress,
  updateCartItem,
  verifyRazorpayPayment
} from '@/lib/api'

type CheckoutStep = 'cart' | 'address' | 'payment' | 'confirmation'

type CartItem = {
  id: number
  product_id: number
  variant_id?: number | null
  quantity: number
  product_name: string
  image_url: string
  effective_price: number
  vendor_store_name?: string
  color?: string
  size?: string
}

type Address = {
  id: number
  label: string
  full_name: string
  phone: string
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
  country: string
  is_default: number
}

type SessionUser = {
  id: number
  name: string
  email: string
  token: string
  role: 'admin' | 'vendor' | 'customer'
}

declare global {
  interface Window {
    Razorpay?: new (options: any) => { open: () => void }
  }
}

export default function Cart() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [items, setItems] = useState<CartItem[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [step, setStep] = useState<CheckoutStep>('cart')
  const [isProcessing, setIsProcessing] = useState(false)
  const [loading, setLoading] = useState(true)

  const [address, setAddress] = useState({
    label: 'Home',
    full_name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: ''
  })

  const [saveAsDefault, setSaveAsDefault] = useState(true)
  const [notes, setNotes] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [billingSameAsDelivery, setBillingSameAsDelivery] = useState(true)

  const paymentOptions = getPaymentOptions()
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'netbanking' | 'wallet' | 'cod'>('cod')

  const [orderDetails, setOrderDetails] = useState<any>(null)

  const loadRazorpayScript = async () => {
    if (window.Razorpay) return true

    return new Promise<boolean>((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const openRazorpayCheckout = async (args: {
    order: any
    session: SessionUser
    addressId: number
  }) => {
    const { order, session, addressId } = args
    const selectedAddress = addresses.find((entry) => Number(entry.id) === Number(addressId))

    const loaded = await loadRazorpayScript()
    if (!loaded || !window.Razorpay) {
      throw new Error('Unable to load Razorpay checkout')
    }

    const RazorpayCtor = window.Razorpay
    if (!RazorpayCtor) {
      throw new Error('Razorpay checkout is unavailable')
    }

    const paymentPayload = await new Promise<{
      razorpay_order_id: string
      razorpay_payment_id: string
      razorpay_signature: string
    }>((resolve, reject) => {
      const razorpay = new RazorpayCtor({
        key: order.razorpay?.key_id,
        amount: order.razorpay?.amount,
        currency: order.razorpay?.currency,
        name: order.razorpay?.name || 'Stella Marketplace',
        description: order.razorpay?.description || `Order #${order.order_id}`,
        order_id: order.razorpay?.order_id,
        prefill: {
          name: selectedAddress?.full_name || session.name,
          email: session.email,
          contact: selectedAddress?.phone || ''
        },
        theme: { color: '#4A7C59' },
        handler: (response: any) => {
          resolve({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          })
        },
        modal: {
          ondismiss: () => reject(new Error('Payment cancelled by user'))
        }
      })

      razorpay.open()
    })

    await verifyRazorpayPayment(session.token, {
      order_id: Number(order.order_id),
      razorpay_order_id: paymentPayload.razorpay_order_id,
      razorpay_payment_id: paymentPayload.razorpay_payment_id,
      razorpay_signature: paymentPayload.razorpay_signature
    })

    return paymentPayload
  }

  useEffect(() => {
    const session = localStorage.getItem('stella-user')
    if (!session) {
      router.replace('/signup')
      return
    }

    const parsed = JSON.parse(session)
    if (!parsed?.token) {
      router.replace('/signup')
      return
    }

    setToken(parsed.token)

    const loadData = async () => {
      setLoading(true)
      try {
        const [cartRes, addressRes] = await Promise.all([
          fetchCart(parsed.token),
          fetchAddresses(parsed.token)
        ])

        setItems(cartRes.items || [])
        const addressList = addressRes.addresses || []
        setAddresses(addressList)
        const defaultAddress = addressList.find((item: Address) => Number(item.is_default) === 1) || addressList[0]
        if (defaultAddress) {
          setSelectedAddressId(Number(defaultAddress.id))
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadData().catch((err) => console.error(err))
  }, [router])

  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + Number(item.effective_price || 0) * Number(item.quantity || 1), 0)
  }, [items])

  const deliveryCharge = subtotal >= 500 ? 0 : 50
  const total = subtotal + deliveryCharge - couponDiscount
  const hasSelectedSavedAddress =
    selectedAddressId !== null && addresses.some((entry) => Number(entry.id) === Number(selectedAddressId))
  const requiresAddressForm = !hasSelectedSavedAddress

  const refreshCart = async () => {
    if (!token) return
    const cartRes = await fetchCart(token)
    setItems(cartRes.items || [])
    window.dispatchEvent(new Event('stella-cart-update'))
  }

  const removeItem = async (cartItemId: number) => {
    if (!token) return
    await removeCartItem(token, cartItemId)
    await refreshCart()
  }

  const moveToWishlist = async (item: CartItem) => {
    if (!token) return
    await addWishlistItem(token, { product_id: item.product_id, variant_id: item.variant_id || null })
    await removeCartItem(token, item.id)
    await refreshCart()
    window.dispatchEvent(new Event('stella-wishlist-update'))
  }

  const updateQuantity = async (cartItemId: number, next: number) => {
    if (!token) return
    if (next < 1) return
    await updateCartItem(token, { cart_item_id: cartItemId, quantity: next })
    await refreshCart()
  }

  const clearEntireCart = async () => {
    if (!token) return
    await clearCart(token)
    await refreshCart()
  }

  const saveNewAddress = async () => {
    if (!token) return

    if (!address.full_name || !address.phone || !address.line1 || !address.city || !address.state || !address.pincode) {
      alert('Please fill all required address fields')
      return
    }

    const response = await saveAddress(token, {
      label: address.label,
      full_name: address.full_name,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: 'India',
      is_default: saveAsDefault
    })

    setAddresses(response.addresses || [])
    const newest = (response.addresses || [])[0]
    if (newest) {
      setSelectedAddressId(Number(newest.id))
    }
  }

  const makeSureAddress = async (): Promise<number | null> => {
    if (selectedAddressId) {
      const exists = addresses.some((item) => Number(item.id) === Number(selectedAddressId))
      if (exists) {
        if (saveAsDefault) {
          await setDefaultAddress(token, selectedAddressId)
        }
        return selectedAddressId
      }
      setSelectedAddressId(null)
    }

    await saveNewAddress()
    const listRes = await fetchAddresses(token)
    const list = listRes.addresses || []
    if (!list.length) return null
    const selected = list.find((item: Address) => Number(item.is_default) === 1) || list[0]
    setAddresses(list)
    setSelectedAddressId(Number(selected.id))
    return Number(selected.id)
  }

  const handlePlaceOrder = async () => {
    if (!token || !items.length) return

    setIsProcessing(true)
    try {
      const sessionRaw = localStorage.getItem('stella-user')
      const session = sessionRaw ? (JSON.parse(sessionRaw) as SessionUser) : null
      if (!session?.token) {
        throw new Error('Please sign in again to continue checkout')
      }

      const addressId = await makeSureAddress()
      if (!addressId) {
        alert('Please provide delivery address')
        setIsProcessing(false)
        return
      }

      const selectedAddress = addresses.find((entry) => Number(entry.id) === Number(addressId))

      const payload = {
        address_id: addressId,
        items: items.map((item) => ({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: item.quantity
        })),
        payment_method: paymentMethod,
        contact_number: selectedAddress?.phone || address.phone || undefined,
        order_notes: notes || undefined,
        coupon_discount: couponDiscount,
        billing_same_as_delivery: billingSameAsDelivery
      }

      const order = await createOrder(payload, token)

      let finalOrder = order
      if (order?.requires_payment && order?.payment_provider === 'razorpay') {
        let verified: {
          razorpay_order_id: string
          razorpay_payment_id: string
          razorpay_signature: string
        }
        try {
          verified = await openRazorpayCheckout({ order, session, addressId })
        } catch (checkoutErr: any) {
          if (checkoutErr?.message === 'Payment cancelled by user') {
            throw new Error('Payment was cancelled. Order is created as pending in your dashboard.')
          }
          throw new Error(checkoutErr?.message || 'Razorpay checkout failed')
        }

        finalOrder = {
          ...order,
          payment_status: 'paid',
          payment_reference: verified.razorpay_payment_id
        }
      }

      setOrderDetails(finalOrder)
      await clearCart(token)
      await refreshCart()
      setStep('confirmation')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to place order')
      await refreshCart().catch(() => undefined)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleProceedToAddress = () => {
    if (items.length === 0) return
    setStep('address')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const addressId = await makeSureAddress()
    if (!addressId) {
      alert('Please select or add an address')
      return
    }
    setStep('payment')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const stepLabels = [
    { key: 'cart', label: '1. Cart' },
    { key: 'address', label: '2. Address' },
    { key: 'payment', label: '3. Payment' },
    { key: 'confirmation', label: '4. Confirmation' },
  ]
  const currentStepIndex = stepLabels.findIndex(s => s.key === step)

  if (loading) {
    return (
      <main className="container" style={{ padding: '100px 2rem' }}>
        <p>Loading your checkout...</p>
      </main>
    )
  }

  return (
    <div className="container" style={{ padding: '2rem 2rem 4rem' }}>
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
                    key={item.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.25rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: '#fff' }}
                  >
                    <img src={item.image_url} alt={item.product_name} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', background: 'var(--bg-soft)' }} />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>{item.product_name}</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{item.vendor_store_name || 'Marketplace Seller'}</p>
                      {item.color && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          Variant: <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{item.color}{item.size ? ` / ${item.size}` : ''}</span>
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '0.5rem' }}>
                        <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} style={{ width: '28px', height: '28px', border: '1px solid var(--border)', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{item.quantity || 1}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} style={{ width: '28px', height: '28px', border: '1px solid var(--border)', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        <button onClick={() => moveToWishlist(item)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-link)', fontSize: '0.78rem', marginLeft: '0.5rem' }}>Move to wishlist</button>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--accent)' }}>Rs {Math.floor(item.effective_price * (item.quantity || 1)).toLocaleString()}</div>
                      <button
                        onClick={() => removeItem(item.id)}
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
                  <span style={{ fontWeight: 600 }}>Rs {Math.floor(subtotal).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.92rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Delivery</span>
                  <span style={{ fontWeight: 600, color: deliveryCharge === 0 ? 'var(--success)' : 'var(--text-main)' }}>
                    {deliveryCharge === 0 ? 'FREE' : `Rs ${deliveryCharge}`}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.92rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Discount</span>
                  <span style={{ fontWeight: 600 }}>Rs {Math.floor(couponDiscount).toLocaleString()}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-light)', margin: '1rem 0', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700 }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--accent)' }}>Rs {Math.floor(total).toLocaleString()}</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Cancel before shipping for full refund. After shipping, return flow applies.
                </p>
                <button className="btn-outline" style={{ width: '100%', padding: '10px', marginBottom: '0.75rem' }} onClick={clearEntireCart}>Clear Cart</button>
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
              {addresses.length > 0 && (
                <div style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.85rem', background: '#fff' }}>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Saved Addresses</h3>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {addresses.map((entry) => (
                      <label key={entry.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.86rem' }}>
                        <input
                          type="radio"
                          checked={selectedAddressId === Number(entry.id)}
                          onChange={() => setSelectedAddressId(Number(entry.id))}
                        />
                        <span>
                          <strong>{entry.label}</strong> - {entry.full_name}, {entry.line1}, {entry.city}, {entry.state} {entry.pincode}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Full Name *</label>
                  <input className="input-field" required={requiresAddressForm} value={address.full_name} onChange={(e) => setAddress({ ...address, full_name: e.target.value })} placeholder="John Doe" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Phone Number *</label>
                  <input className="input-field" required={requiresAddressForm} type="tel" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Address Line 1 *</label>
                <input className="input-field" required={requiresAddressForm} value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} placeholder="House no., Building, Street" />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Address Line 2</label>
                <input className="input-field" value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} placeholder="Landmark, Area (optional)" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>City *</label>
                  <input className="input-field" required={requiresAddressForm} value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} placeholder="Mumbai" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>State *</label>
                  <input className="input-field" required={requiresAddressForm} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} placeholder="Maharashtra" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Pincode *</label>
                  <input className="input-field" required={requiresAddressForm} value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value })} placeholder="400001" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn-outline" onClick={saveNewAddress}>Save Address</button>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={saveAsDefault} onChange={(e) => setSaveAsDefault(e.target.checked)} />
                  Set as default address
                </label>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Order Notes / Special Instructions</label>
                <textarea className="input-field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any delivery notes for seller" />
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
                <span style={{ color: 'var(--accent)' }}>Rs {Math.floor(total).toLocaleString()}</span>
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
              {paymentOptions.map((option) => (
                <div
                  key={option.id}
                  className={`payment-option ${paymentMethod === option.id ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod(option.id)}
                >
                  <input type="radio" name="payment" checked={paymentMethod === option.id} readOnly />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{option.label}</div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {option.id === 'cod'
                        ? 'Pay after delivery. Your order remains pending until successful handoff.'
                        : 'Secured by Razorpay. Payment is verified server-side before confirmation.'}
                    </p>
                  </div>
                </div>
              ))}

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.75rem', fontSize: '0.88rem' }}>
                <input type="checkbox" checked={billingSameAsDelivery} onChange={(e) => setBillingSameAsDelivery(e.target.checked)} />
                Billing address same as delivery
              </label>

              <div className="input-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                <label>Coupon Discount (Rs)</label>
                <input
                  className="input-field"
                  type="number"
                  min={0}
                  max={Math.floor(subtotal)}
                  value={couponDiscount}
                  onChange={(e) => setCouponDiscount(Math.max(0, Number(e.target.value || 0)))}
                />
              </div>

              <button
                className="btn-primary"
                style={{ marginTop: '1.5rem', padding: '16px 40px' }}
                onClick={handlePlaceOrder}
                disabled={isProcessing}
              >
                {isProcessing ? 'Placing Order...' : `Place Order — Rs ${Math.floor(total).toLocaleString()}`}
              </button>
            </div>

            {/* Summary sidebar */}
            <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1.5rem', background: '#fff', position: 'sticky', top: '100px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Delivery Address</h3>
              {selectedAddressId ? (
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {(() => {
                    const selected = addresses.find((entry) => Number(entry.id) === selectedAddressId)
                    if (!selected) return 'No address selected'
                    return (
                      <>
                        <strong>{selected.full_name}</strong><br />
                        {selected.line1}<br />
                        {selected.line2 && <>{selected.line2}<br /></>}
                        {selected.city}, {selected.state} - {selected.pincode}<br />
                        📞 {selected.phone}
                      </>
                    )
                  })()}
                </p>
              ) : (
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>No address selected yet.</p>
              )}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{items.length} item(s)</span>
                  <span style={{ fontWeight: 600 }}>Rs {Math.floor(subtotal).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Delivery</span>
                  <span style={{ fontWeight: 600, color: deliveryCharge === 0 ? 'var(--success)' : undefined }}>{deliveryCharge === 0 ? 'FREE' : `Rs ${deliveryCharge}`}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Discount</span>
                  <span style={{ fontWeight: 600 }}>Rs {Math.floor(couponDiscount).toLocaleString()}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem' }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--accent)' }}>Rs {Math.floor(total).toLocaleString()}</span>
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
            Order ID: <strong style={{ color: 'var(--text-main)' }}>{orderDetails.order_id}</strong>
          </p>

          <div className="order-details-card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📦 Order Details</h3>
            <div className="order-detail-row">
              <span style={{ color: 'var(--text-secondary)' }}>Order Date</span>
              <span style={{ fontWeight: 600 }}>{orderDetails.created_at}</span>
            </div>
            <div className="order-detail-row">
              <span style={{ color: 'var(--text-secondary)' }}>Payment Provider</span>
              <span style={{ fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase' }}>{orderDetails.payment_provider}</span>
            </div>
            <div className="order-detail-row">
              <span style={{ color: 'var(--text-secondary)' }}>Payment Method</span>
              <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{paymentMethod}</span>
            </div>
            <div className="order-detail-row">
              <span style={{ color: 'var(--text-secondary)' }}>Reference</span>
              <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '200px' }}>{orderDetails.payment_reference}</span>
            </div>
            <div className="order-detail-row" style={{ borderBottom: 'none' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Amount</span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent)' }}>Rs {Math.floor(orderDetails.total_amount).toLocaleString()}</span>
            </div>
          </div>

          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
            Vendors will manually move status: Order Placed → Processing → Shipped → Delivered → Completed.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link href="/" className="btn-primary" style={{ padding: '14px 24px' }}>Continue Shopping</Link>
            <Link href="/user" className="btn-outline" style={{ padding: '14px 24px' }}>Track Orders</Link>
          </div>
        </div>
      )}
    </div>
  )
}

