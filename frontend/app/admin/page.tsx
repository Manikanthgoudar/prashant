'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchAdminDashboard, fetchOrders } from '@/lib/api'

export default function AdminDashboardPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [dashboard, setDashboard] = useState<any>(null)
    const [orders, setOrders] = useState<any[]>([])

    const loadData = async (authToken: string) => {
        const [dashboardRes, ordersRes] = await Promise.all([
            fetchAdminDashboard(authToken),
            fetchOrders(authToken)
        ])

        setDashboard(dashboardRes)
        setOrders(ordersRes.orders || [])
    }

    useEffect(() => {
        const session = localStorage.getItem('stella-user')
        const parsed = session ? JSON.parse(session) : null

        if (!parsed?.token || parsed?.role !== 'admin') {
            router.replace('/signup')
            return
        }

        loadData(parsed.token)
            .catch((err) => {
                console.error(err)
                router.replace('/signup')
            })
            .finally(() => setLoading(false))
    }, [router])

    const monthlyMax = useMemo(() => {
        const points = dashboard?.monthly_trend || []
        return Math.max(1, ...points.map((point: any) => Number(point.sales || 0)))
    }, [dashboard])

    if (loading) {
        return (
            <main className="container" style={{ padding: '100px 2rem' }}>
                <p>Loading admin dashboard...</p>
            </main>
        )
    }

    if (!dashboard) {
        return (
            <main className="container" style={{ padding: '100px 2rem' }}>
                <p>Unable to load admin dashboard data.</p>
            </main>
        )
    }

    const summary = dashboard.summary || {}

    return (
        <main className="container" style={{ padding: '2rem 2rem 4rem' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Admin Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Approve ecosystem operations, monitor platform transactions, and track marketplace growth.
            </p>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Customers', value: summary.customers || 0 },
                    { label: 'Vendors', value: summary.vendors || 0 },
                    { label: 'Products', value: summary.products || 0 },
                    { label: 'Orders', value: summary.orders || 0 },
                    { label: 'Gross Sales', value: summary.gross_sales || 0, money: true },
                    { label: 'Commission', value: summary.commission || 0, money: true },
                    { label: 'Vendor Payout', value: summary.vendor_payout || 0, money: true },
                    { label: 'Refunds', value: summary.refunds || 0, money: true }
                ].map((card) => (
                    <div key={card.label} style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff' }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{card.label}</div>
                        <div style={{ marginTop: '0.45rem', fontSize: '1.3rem', fontWeight: 700 }}>
                            {card.money ? `Rs ${Math.floor(Number(card.value)).toLocaleString()}` : Number(card.value).toLocaleString()}
                        </div>
                    </div>
                ))}
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff' }}>
                    <h2 style={{ marginBottom: '0.75rem' }}>Transaction Trend</h2>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {(dashboard.monthly_trend || []).map((point: any) => {
                            const width = (Number(point.sales || 0) / monthlyMax) * 100
                            return (
                                <div key={point.month}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                        <span>{point.month}</span>
                                        <span>Rs {Math.floor(Number(point.sales || 0)).toLocaleString()}</span>
                                    </div>
                                    <div style={{ height: '10px', borderRadius: '999px', background: 'var(--bg-soft)', overflow: 'hidden' }}>
                                        <div style={{ width: `${width}%`, height: '100%', background: 'linear-gradient(90deg, #232F3E, #4A7C59)' }} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff' }}>
                    <h2 style={{ marginBottom: '0.75rem' }}>Category Breakdown</h2>
                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                        {(dashboard.category_breakdown || []).slice(0, 15).map((entry: any) => (
                            <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.4rem' }}>
                                <span>{entry.name}</span>
                                <span>{entry.product_count} products</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff', marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.75rem' }}>Recent Transactions</h2>
                <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'grid', gap: '0.4rem' }}>
                    {(dashboard.recent_transactions || []).slice(0, 120).map((transaction: any) => (
                        <div key={transaction.id} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.4rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ textTransform: 'capitalize' }}>
                                    {transaction.transaction_type} · {transaction.vendor_store_name || transaction.vendor_name || 'Platform'}
                                </span>
                                <span>
                                    Rs {Math.floor(Number(transaction.gross_amount || transaction.commission_amount || transaction.payout_amount || transaction.refund_amount || 0)).toLocaleString()}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                Order #{transaction.order_id} · {transaction.customer_name || 'N/A'} · {transaction.created_at}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff' }}>
                <h2 style={{ marginBottom: '0.75rem' }}>Order Monitoring</h2>
                <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'grid', gap: '0.5rem' }}>
                    {orders.slice(0, 120).map((order) => (
                        <div key={order.id} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.45rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                                <span>Order #{order.id} · {order.customer_name || 'Customer'}</span>
                                <span>Rs {Math.floor(Number(order.total_amount || 0)).toLocaleString()}</span>
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                Status: {order.status} · Payment: {order.payment_status} · Items: {order.item_count || '-'}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    )
}
