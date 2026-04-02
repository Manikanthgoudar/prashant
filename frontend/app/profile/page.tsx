'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    addCartItem,
    fetchOrderHistory,
    fetchWishlist,
    getCurrentUser,
    removeWishlistItem,
    updateOrderAction
} from '@/lib/api'

export default function ProfilePage() {
    const router = useRouter()
    const [token, setToken] = useState('')
    const [user, setUser] = useState<{ id: number; name: string; email: string; role: string } | null>(null)
    const [orders, setOrders] = useState<any[]>([])
    const [wishlistItems, setWishlistItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    const loadProfileData = async (authToken: string) => {
        const [userRes, historyRes, wishlistRes] = await Promise.all([
            getCurrentUser(authToken),
            fetchOrderHistory(authToken).catch(() => ({ orders: [] })),
            fetchWishlist(authToken).catch(() => ({ items: [] }))
        ])

        setUser(userRes.user)
        setOrders(historyRes.orders || [])
        setWishlistItems(wishlistRes.items || [])
    }

    useEffect(() => {
        const stored = localStorage.getItem('stella-user')
        const parsed = stored ? JSON.parse(stored) : null
        const token = parsed?.token
        if (!token) {
            router.replace('/signup')
            return
        }
        setToken(token)

        loadProfileData(token)
            .catch(() => {
                localStorage.removeItem('stella-user')
                router.replace('/signup')
            })
            .finally(() => setLoading(false))
    }, [router])

    const handleCancelOrder = async (orderId: number) => {
        if (!token) return
        setActionLoading(true)
        try {
            await updateOrderAction(token, orderId, { action: 'cancel' })
            await loadProfileData(token)
        } catch (err: any) {
            alert(err.message || 'Unable to cancel order')
        } finally {
            setActionLoading(false)
        }
    }

    const handleReturnItem = async (orderId: number, itemId: number) => {
        if (!token) return
        const reason = window.prompt('Enter return reason', 'Item not as expected') || 'Customer requested return'
        setActionLoading(true)
        try {
            await updateOrderAction(token, orderId, { action: 'request_return', item_id: itemId, reason })
            await loadProfileData(token)
        } catch (err: any) {
            alert(err.message || 'Unable to request return')
        } finally {
            setActionLoading(false)
        }
    }

    const moveWishlistToCart = async (wishlistItem: any) => {
        if (!token) return
        setActionLoading(true)
        try {
            await addCartItem(token, {
                product_id: Number(wishlistItem.product_id),
                variant_id: wishlistItem.variant_id ? Number(wishlistItem.variant_id) : null,
                quantity: 1
            })
            await removeWishlistItem(token, { wishlist_item_id: Number(wishlistItem.id) })
            await loadProfileData(token)
            window.dispatchEvent(new Event('stella-cart-update'))
            window.dispatchEvent(new Event('stella-wishlist-update'))
        } catch (err: any) {
            alert(err.message || 'Unable to move item')
        } finally {
            setActionLoading(false)
        }
    }

    if (loading) {
        return (
            <main className="container" style={{ padding: '120px 2rem', textAlign: 'center' }}>
                <p>Loading your profile...</p>
            </main>
        )
    }

    if (!user) return null

    return (
        <main className="container" style={{ padding: '120px 2rem', maxWidth: '720px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow-md)' }}>
                    <h1 style={{ fontSize: '1.8rem', marginBottom: '12px' }}>Your Profile</h1>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Manage your account details, orders, and wishlist.</p>

                    <div style={{ display: 'grid', gap: '16px' }}>
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Name</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{user.name}</div>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Email</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{user.email}</div>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Role</div>
                            <div style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{user.role}</div>
                        </div>
                    </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow-md)' }}>
                    <h2 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>Wishlist</h2>
                    {wishlistItems.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No saved items yet.</p>
                    ) : (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {wishlistItems.map((item) => (
                                <div key={item.id} style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <img src={item.image_url} alt={item.product_name} style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {item.color ? `${item.color}${item.size ? ` / ${item.size}` : ''}` : 'Default variant'}
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: 700, color: 'var(--accent)' }}>Rs {Math.floor(Number(item.effective_price || 0)).toLocaleString()}</div>
                                    <button className="btn-outline" style={{ padding: '8px 12px' }} disabled={actionLoading} onClick={() => moveWishlistToCart(item)}>
                                        Move to Cart
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow-md)' }}>
                    <h2 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>Order History</h2>
                    {orders.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No orders yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {orders.map((order) => (
                                <div key={order.id} style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>Order #{order.id}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{new Date(order.created_at).toLocaleString()}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textTransform: 'capitalize' }}>
                                                Status: {order.status} · Payment: {order.payment_status}
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 700 }}>Rs {Math.floor(order.total_amount).toLocaleString()}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {(order.items || []).map((item: any) => (
                                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.95rem' }}>
                                                {item.product_image && (
                                                    <img src={item.product_image} alt={item.product_name} style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
                                                )}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                        Qty: {item.quantity}{item.color ? ` · ${item.color}` : ''}{item.size ? ` / ${item.size}` : ''}
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'capitalize' }}>
                                                        Item Status: {item.status}{item.mock_tracking_number ? ` · ${item.mock_tracking_number}` : ''}
                                                    </div>
                                                </div>
                                                <div style={{ fontWeight: 600 }}>Rs {Math.floor(item.line_total).toLocaleString()}</div>
                                                {(item.status === 'shipped' || item.status === 'delivered' || item.status === 'completed') && (
                                                    <button className="btn-outline" style={{ padding: '6px 10px' }} disabled={actionLoading} onClick={() => handleReturnItem(order.id, item.id)}>
                                                        Return
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {(order.items || []).every((item: any) => item.status === 'placed' || item.status === 'processing') && (
                                        <div style={{ marginTop: '12px' }}>
                                            <button className="btn-outline" disabled={actionLoading} onClick={() => handleCancelOrder(order.id)}>
                                                Cancel Order
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
