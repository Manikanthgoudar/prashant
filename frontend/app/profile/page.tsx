'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, fetchOrderHistory } from '@/lib/api'

export default function ProfilePage() {
    const router = useRouter()
    const [user, setUser] = useState<{ id: number; name: string; email: string } | null>(null)
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const stored = localStorage.getItem('stella-user')
        const parsed = stored ? JSON.parse(stored) : null
        const token = parsed?.token
        if (!token) {
            router.replace('/signup')
            return
        }

        Promise.all([
            getCurrentUser(token),
            fetchOrderHistory(token).catch(() => ({ orders: [] }))
        ])
            .then(([userRes, historyRes]) => {
                setUser(userRes.user)
                setOrders(historyRes.orders || [])
            })
            .catch(() => {
                localStorage.removeItem('stella-user')
                router.replace('/signup')
            })
            .finally(() => setLoading(false))
    }, [router])

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
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Manage your account details.</p>

                    <div style={{ display: 'grid', gap: '16px' }}>
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Name</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{user.name}</div>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Email</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{user.email}</div>
                        </div>
                    </div>
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
                                        </div>
                                        <div style={{ fontWeight: 700 }}>₹{Math.floor(order.total_amount).toLocaleString()}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {(order.items || []).map((item: any) => (
                                            <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.95rem' }}>
                                                {item.product_image && (
                                                    <img src={item.product_image} alt={item.product_name} style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
                                                )}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                        Qty: {item.quantity}{item.color ? ` · ${item.color}` : ''}
                                                    </div>
                                                </div>
                                                <div style={{ fontWeight: 600 }}>₹{Math.floor(item.price_each * item.quantity).toLocaleString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
