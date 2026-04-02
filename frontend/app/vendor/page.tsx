'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    createProduct,
    deactivateProduct,
    fetchCategories,
    fetchProducts,
    fetchVendorDashboard,
    updateOrderAction,
    updateProduct,
    updateReturnStatus
} from '@/lib/api'

const STATUS_OPTIONS = ['placed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled']

export default function VendorDashboardPage() {
    const router = useRouter()
    const [token, setToken] = useState('')
    const [vendorId, setVendorId] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [data, setData] = useState<any>(null)
    const [categories, setCategories] = useState<any[]>([])
    const [vendorProducts, setVendorProducts] = useState<any[]>([])
    const [newProduct, setNewProduct] = useState({
        name: '',
        description: '',
        brand: '',
        category_id: '',
        price: '',
        stock: '',
        discount_percent: '',
        image_url: '',
        tags: ''
    })

    const loadDashboard = async (authToken: string, sellerId: number) => {
        const [dashboardResult, productResult, categoriesResult] = await Promise.all([
            fetchVendorDashboard(authToken),
            fetchProducts({ vendor_id: sellerId, sort: 'newest', include_inactive: true }),
            fetchCategories()
        ])

        setData(dashboardResult)
        setVendorProducts(productResult)
        setCategories(categoriesResult)
    }

    useEffect(() => {
        const session = localStorage.getItem('stella-user')
        const parsed = session ? JSON.parse(session) : null
        if (!parsed?.token || parsed?.role !== 'vendor') {
            router.replace('/signup')
            return
        }

        setToken(parsed.token)
        setVendorId(Number(parsed.id))
        loadDashboard(parsed.token, Number(parsed.id))
            .catch((err) => {
                console.error(err)
                router.replace('/signup')
            })
            .finally(() => setLoading(false))
    }, [router])

    const monthlyMax = useMemo(() => {
        const points = data?.monthly_trend || []
        return Math.max(1, ...points.map((point: any) => Number(point.sales || 0)))
    }, [data])

    const updateItemStatus = async (orderId: number, itemId: number, status: string) => {
        if (!token || !vendorId) return
        setSaving(true)
        try {
            await updateOrderAction(token, orderId, { action: 'update_status', item_id: itemId, status })
            await loadDashboard(token, vendorId)
        } catch (err: any) {
            alert(err.message || 'Unable to update status')
        } finally {
            setSaving(false)
        }
    }

    const handleReturnStatus = async (returnId: number, status: string) => {
        if (!token || !vendorId) return
        setSaving(true)
        try {
            await updateReturnStatus(token, { return_id: returnId, status })
            await loadDashboard(token, vendorId)
        } catch (err: any) {
            alert(err.message || 'Unable to update return')
        } finally {
            setSaving(false)
        }
    }

    const saveQuickProductFields = async (product: any) => {
        if (!token || !vendorId) return
        setSaving(true)
        try {
            await updateProduct(token, Number(product.id), {
                price: Number(product.price),
                stock: Number(product.stock),
                discount_percent: Number(product.discount_percent || 0)
            })
            await loadDashboard(token, vendorId)
        } catch (err: any) {
            alert(err.message || 'Unable to update product')
        } finally {
            setSaving(false)
        }
    }

    const createNewProduct = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!token || !vendorId) return

        if (!newProduct.name || !newProduct.category_id || !newProduct.price) {
            alert('Name, category and price are required')
            return
        }

        setSaving(true)
        try {
            await createProduct(token, {
                name: newProduct.name,
                description: newProduct.description,
                brand: newProduct.brand,
                category_id: Number(newProduct.category_id),
                price: Number(newProduct.price),
                stock: Number(newProduct.stock || 0),
                discount_percent: Number(newProduct.discount_percent || 0),
                image_url: newProduct.image_url,
                images: newProduct.image_url ? [newProduct.image_url] : [],
                tags: newProduct.tags
            })

            setNewProduct({
                name: '',
                description: '',
                brand: '',
                category_id: '',
                price: '',
                stock: '',
                discount_percent: '',
                image_url: '',
                tags: ''
            })
            await loadDashboard(token, vendorId)
        } catch (err: any) {
            alert(err.message || 'Unable to create product')
        } finally {
            setSaving(false)
        }
    }

    const deactivateExistingProduct = async (productId: number) => {
        if (!token || !vendorId) return
        if (!window.confirm('Deactivate this product listing?')) return

        setSaving(true)
        try {
            await deactivateProduct(token, productId)
            await loadDashboard(token, vendorId)
        } catch (err: any) {
            alert(err.message || 'Unable to deactivate product')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <main className="container" style={{ padding: '100px 2rem' }}>
                <p>Loading vendor dashboard...</p>
            </main>
        )
    }

    if (!data) {
        return (
            <main className="container" style={{ padding: '100px 2rem' }}>
                <p>Unable to load vendor dashboard.</p>
            </main>
        )
    }

    const summary = data.summary || {}

    return (
        <main className="container" style={{ padding: '2rem 2rem 4rem' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Vendor Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Track orders, payouts, returns, refunds, and transaction trends.</p>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Gross Sales', value: summary.gross_sales || 0 },
                    { label: 'Platform Commission', value: summary.platform_commission || 0 },
                    { label: 'Net Payout', value: summary.net_payout || 0 },
                    { label: 'Refunds', value: summary.refunds || 0 }
                ].map((item) => (
                    <div key={item.label} style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff' }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{item.label}</div>
                        <div style={{ marginTop: '0.45rem', fontSize: '1.35rem', fontWeight: 700 }}>Rs {Math.floor(Number(item.value)).toLocaleString()}</div>
                    </div>
                ))}
            </section>

            <section style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff', marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.75rem' }}>Monthly Trend</h2>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {(data.monthly_trend || []).map((point: any) => {
                        const width = (Number(point.sales || 0) / monthlyMax) * 100
                        return (
                            <div key={point.month}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                    <span>{point.month}</span>
                                    <span>Rs {Math.floor(Number(point.sales || 0)).toLocaleString()}</span>
                                </div>
                                <div style={{ height: '10px', borderRadius: '999px', background: 'var(--bg-soft)', overflow: 'hidden' }}>
                                    <div style={{ width: `${width}%`, height: '100%', background: 'linear-gradient(90deg, #4A7C59, #7da588)' }} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>

            <section style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff', marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.75rem' }}>Manage Products</h2>

                <form onSubmit={createNewProduct} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.8rem' }}>
                    <input className="input-field" placeholder="Product name" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
                    <select className="input-field" value={newProduct.category_id} onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}>
                        <option value="">Category</option>
                        {categories.filter((category) => category.parent_id !== null).map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                    </select>
                    <input className="input-field" placeholder="Price" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} />
                    <input className="input-field" placeholder="Stock" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} />
                    <input className="input-field" placeholder="Discount %" value={newProduct.discount_percent} onChange={(e) => setNewProduct({ ...newProduct, discount_percent: e.target.value })} />
                    <button className="btn-primary" style={{ padding: '10px 12px' }} disabled={saving}>Add</button>
                </form>

                <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                    <label>New Product Description and Primary Image URL</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                        <input className="input-field" placeholder="Description" value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} />
                        <input className="input-field" placeholder="Brand" value={newProduct.brand} onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })} />
                        <input className="input-field" placeholder="Image URL" value={newProduct.image_url} onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })} />
                    </div>
                </div>

                <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                    <label>Tags (comma separated)</label>
                    <input
                        className="input-field"
                        placeholder="Example: Men, Summer, Casual"
                        value={newProduct.tags}
                        onChange={(e) => setNewProduct({ ...newProduct, tags: e.target.value })}
                    />
                </div>

                <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {vendorProducts.slice(0, 30).map((product) => (
                        <div key={product.id} style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.7rem', display: 'grid', gridTemplateColumns: '1.2fr 120px 120px 120px auto auto', gap: '0.5rem', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600 }}>{product.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{product.category_name || 'Category'} · {product.brand || 'Brandless'}</div>
                            </div>
                            <input
                                className="input-field"
                                value={product.price}
                                onChange={(e) => setVendorProducts((prev) => prev.map((row) => row.id === product.id ? { ...row, price: e.target.value } : row))}
                            />
                            <input
                                className="input-field"
                                value={product.stock}
                                onChange={(e) => setVendorProducts((prev) => prev.map((row) => row.id === product.id ? { ...row, stock: e.target.value } : row))}
                            />
                            <input
                                className="input-field"
                                value={product.discount_percent || 0}
                                onChange={(e) => setVendorProducts((prev) => prev.map((row) => row.id === product.id ? { ...row, discount_percent: e.target.value } : row))}
                            />
                            <button className="btn-outline" style={{ padding: '8px 10px' }} disabled={saving} onClick={() => saveQuickProductFields(product)}>Save</button>
                            <button className="btn-outline" style={{ padding: '8px 10px', color: 'var(--danger)' }} disabled={saving} onClick={() => deactivateExistingProduct(Number(product.id))}>Deactivate</button>
                        </div>
                    ))}
                </div>
            </section>

            <section style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff', marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.75rem' }}>Order Items</h2>
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                    {(data.order_items || []).slice(0, 40).map((item: any) => (
                        <div key={item.id} style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.75rem', display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.75rem', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    Order #{item.order_id} · {item.customer_name} · Qty {item.quantity}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Tracking: {item.mock_tracking_number || 'Pending'}
                                </div>
                            </div>
                            <div style={{ fontWeight: 700, color: 'var(--accent)' }}>Rs {Math.floor(Number(item.vendor_payout || 0)).toLocaleString()}</div>
                            <div style={{ fontSize: '0.82rem', textTransform: 'capitalize' }}>{item.status}</div>
                            <select
                                className="input-field"
                                value={item.status}
                                onChange={(e) => updateItemStatus(Number(item.order_id), Number(item.id), e.target.value)}
                                disabled={saving}
                                style={{ width: '180px' }}
                            >
                                {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
            </section>

            <section style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff', marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.75rem' }}>Returns & Refunds</h2>
                {(data.returns_refunds || []).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No return requests.</p>
                ) : (
                    <div style={{ display: 'grid', gap: '0.6rem' }}>
                        {(data.returns_refunds || []).map((entry: any) => (
                            <div key={entry.id} style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.75rem', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{entry.product_name}</div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Order #{entry.order_id} · {entry.customer_name}</div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Reason: {entry.reason || 'N/A'}</div>
                                </div>
                                <div style={{ fontSize: '0.82rem', textTransform: 'capitalize' }}>{entry.status}</div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn-outline" style={{ padding: '8px 10px' }} disabled={saving} onClick={() => handleReturnStatus(Number(entry.id), 'approved')}>Approve</button>
                                    <button className="btn-outline" style={{ padding: '8px 10px' }} disabled={saving} onClick={() => handleReturnStatus(Number(entry.id), 'refunded')}>Refund</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff', marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.75rem' }}>Recent Transactions</h2>
                <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'grid', gap: '0.4rem' }}>
                    {(data.transactions || []).slice(0, 80).map((transaction: any) => (
                        <div key={transaction.id} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.45rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ textTransform: 'capitalize' }}>{transaction.transaction_type}</span>
                                <span>Rs {Math.floor(Number(transaction.gross_amount || transaction.payout_amount || transaction.refund_amount || 0)).toLocaleString()}</span>
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>#{transaction.reference} · {transaction.created_at}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff' }}>
                <h2 style={{ marginBottom: '0.75rem' }}>Low Stock Watch</h2>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {(data.low_stock_products || []).slice(0, 20).map((product: any) => (
                        <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                            <span>{product.name}</span>
                            <span style={{ color: Number(product.stock) < 5 ? 'var(--danger)' : 'var(--text-secondary)' }}>Stock: {product.stock}</span>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    )
}
