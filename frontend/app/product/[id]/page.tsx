'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
    addCartItem,
    addWishlistItem,
    fetchProductById,
    fetchProductReviews,
    submitProductReview
} from '@/lib/api'

export default function ProductDetailPage() {
    const params = useParams<{ id: string }>()
    const router = useRouter()
    const productId = Number(params?.id)

    const [loading, setLoading] = useState(true)
    const [product, setProduct] = useState<any>(null)
    const [reviews, setReviews] = useState<any[]>([])
    const [selectedImage, setSelectedImage] = useState('')
    const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
    const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '' })
    const [submittingReview, setSubmittingReview] = useState(false)

    const selectedVariant = useMemo(() => {
        if (!selectedVariantId || !product?.variants) return null
        return product.variants.find((variant: any) => Number(variant.id) === selectedVariantId) || null
    }, [selectedVariantId, product])

    const effectivePrice = useMemo(() => {
        const base = Number(product?.effective_price || product?.price || 0)
        const additional = Number(selectedVariant?.additional_price || 0)
        return base + additional
    }, [product, selectedVariant])

    const loadData = async () => {
        if (!productId || Number.isNaN(productId)) return

        setLoading(true)
        try {
            const [productRes, reviewRes] = await Promise.all([
                fetchProductById(productId),
                fetchProductReviews(productId)
            ])

            setProduct(productRes)
            setReviews(reviewRes.reviews || [])

            const initialImage = productRes.images?.[0]?.image_url || productRes.image_url || ''
            setSelectedImage(initialImage)

            if (productRes.variants?.length) {
                setSelectedVariantId(Number(productRes.variants[0].id))
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData().catch((err) => console.error(err))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId])

    const requireSession = () => {
        const raw = localStorage.getItem('stella-user')
        if (!raw) {
            router.push('/signup')
            return null
        }
        return JSON.parse(raw)
    }

    const handleAddToCart = async () => {
        const session = requireSession()
        if (!session) return

        try {
            await addCartItem(session.token, {
                product_id: product.id,
                variant_id: selectedVariantId,
                quantity: 1
            })
            window.dispatchEvent(new Event('stella-cart-update'))
            router.push('/cart')
        } catch (err) {
            console.error(err)
            alert('Unable to add to cart')
        }
    }

    const handleWishlist = async () => {
        const session = requireSession()
        if (!session) return

        try {
            await addWishlistItem(session.token, { product_id: product.id, variant_id: selectedVariantId })
            window.dispatchEvent(new Event('stella-wishlist-update'))
        } catch (err) {
            console.error(err)
            alert('Unable to add to wishlist')
        }
    }

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault()
        const session = requireSession()
        if (!session) return

        setSubmittingReview(true)
        try {
            await submitProductReview(session.token, product.id, reviewForm)
            setReviewForm({ rating: 5, title: '', comment: '' })
            await loadData()
        } catch (err: any) {
            alert(err.message || 'Unable to submit review')
        } finally {
            setSubmittingReview(false)
        }
    }

    if (loading) {
        return (
            <main className="container" style={{ padding: '100px 2rem' }}>
                <p>Loading product details...</p>
            </main>
        )
    }

    if (!product) {
        return (
            <main className="container" style={{ padding: '100px 2rem' }}>
                <p>Product not found.</p>
            </main>
        )
    }

    return (
        <main className="container" style={{ padding: '2rem 2rem 4rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '2rem' }}>
                <section>
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: '#fff', padding: '1rem' }}>
                        <div
                            style={{
                                width: '100%',
                                height: '460px',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                background: 'var(--bg-soft)',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                        >
                            <img
                                src={selectedImage || product.image_url}
                                alt={product.name}
                                style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.04)', cursor: 'zoom-in' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.5rem', marginTop: '0.75rem' }}>
                            {(product.images || []).map((image: any) => (
                                <button
                                    key={image.id}
                                    onClick={() => setSelectedImage(image.image_url)}
                                    style={{
                                        border: selectedImage === image.image_url ? '2px solid var(--accent)' : '1px solid var(--border-light)',
                                        borderRadius: '8px',
                                        padding: '4px',
                                        background: '#fff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <img src={image.image_url} alt={product.name} style={{ width: '100%', height: '64px', objectFit: 'contain' }} />
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <section>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{product.vendor_store_name || product.vendor_name}</p>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>{product.name}</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{product.description}</p>

                    <div style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
                        ⭐ {Number(product.avg_rating || 0).toFixed(1)} ({Number(product.review_count || 0)} reviews)
                    </div>

                    {(product.tags || []).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1rem' }}>
                            {(product.tags || []).slice(0, 8).map((tag: string) => (
                                <span
                                    key={tag}
                                    style={{
                                        border: '1px solid var(--border-light)',
                                        borderRadius: '999px',
                                        padding: '3px 10px',
                                        fontSize: '0.78rem',
                                        color: 'var(--text-muted)',
                                        background: 'var(--bg-soft)'
                                    }}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '2rem', color: 'var(--accent)', fontWeight: 700 }}>Rs {Math.floor(effectivePrice).toLocaleString()}</span>
                        {Number(product.discount_percent || 0) > 0 && (
                            <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>Rs {Math.floor(Number(product.price)).toLocaleString()}</span>
                        )}
                        {Number(product.discount_percent || 0) > 0 && <span className="badge badge-sale">{product.discount_percent}% OFF</span>}
                    </div>

                    {product.variants?.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                            <h3 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>Variants</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {product.variants.map((variant: any) => (
                                    <button
                                        key={variant.id}
                                        onClick={() => setSelectedVariantId(Number(variant.id))}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            border: selectedVariantId === Number(variant.id) ? '2px solid var(--accent)' : '1px solid var(--border)',
                                            background: '#fff',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {(variant.color || 'Default')}{variant.size ? ` / ${variant.size}` : ''}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                        Delivery: {Number(effectivePrice) >= 500 ? <strong style={{ color: 'var(--success)' }}>Free</strong> : <strong>Rs 50</strong>}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <button className="btn-primary" onClick={handleAddToCart} style={{ padding: '14px 24px' }}>Add to Cart</button>
                        <button className="btn-outline" onClick={handleWishlist} style={{ padding: '14px 24px' }}>Save to Wishlist</button>
                    </div>

                    <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff' }}>
                        <h3 style={{ marginBottom: '0.5rem' }}>Product Details</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Category: {product.category?.name}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Brand: {product.brand || 'Marketplace'}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Stock: {product.stock}</p>
                    </div>
                </section>
            </div>

            <section style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff' }}>
                    <h3 style={{ marginBottom: '0.75rem' }}>Write a Review</h3>
                    <form onSubmit={handleSubmitReview} style={{ display: 'grid', gap: '0.75rem' }}>
                        <select
                            className="input-field"
                            value={reviewForm.rating}
                            onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                        >
                            {[5, 4, 3, 2, 1].map((value) => (
                                <option key={value} value={value}>{value} Star</option>
                            ))}
                        </select>
                        <input
                            className="input-field"
                            placeholder="Review title"
                            value={reviewForm.title}
                            onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                        />
                        <textarea
                            className="input-field"
                            placeholder="Share your experience"
                            value={reviewForm.comment}
                            onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                            rows={4}
                        />
                        <button className="btn-primary" disabled={submittingReview}>
                            {submittingReview ? 'Submitting...' : 'Submit Review'}
                        </button>
                    </form>
                </div>

                <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1rem', background: '#fff' }}>
                    <h3 style={{ marginBottom: '0.75rem' }}>Customer Reviews</h3>
                    <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'grid', gap: '0.75rem' }}>
                        {reviews.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No reviews yet.</p>}
                        {reviews.map((review) => (
                            <div key={review.id} style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.75rem' }}>
                                <p style={{ fontWeight: 600 }}>{review.user_name} - {review.rating}★</p>
                                {review.title && <p style={{ marginTop: '0.25rem', fontWeight: 600 }}>{review.title}</p>}
                                {review.comment && <p style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}>{review.comment}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {product.recommendations?.length > 0 && (
                <section style={{ marginTop: '3rem' }}>
                    <h2 style={{ marginBottom: '1rem' }}>You may also like</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.9rem' }}>
                        {product.recommendations.map((item: any) => (
                            <Link key={item.id} href={`/product/${item.id}`} style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.6rem', background: '#fff' }}>
                                <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '150px', objectFit: 'contain' }} />
                                <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>{item.name}</p>
                                <p style={{ color: 'var(--accent)', fontWeight: 700 }}>Rs {Math.floor(Number(item.effective_price || item.price)).toLocaleString()}</p>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </main>
    )
}
