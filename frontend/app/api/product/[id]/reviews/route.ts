import { NextRequest, NextResponse } from 'next/server'
import { getConnection, query } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    const productId = Number(id)
    if (Number.isNaN(productId)) {
        return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
    }

    try {
        const reviews = await query<any>(
            `SELECT r.id, r.product_id, r.user_id, u.name AS user_name, r.rating, r.title, r.comment, r.created_at
             FROM reviews r
             JOIN users u ON u.id = r.user_id
             WHERE r.product_id = ?
             ORDER BY r.created_at DESC`,
            [productId]
        )

        const summary = await query<any>(
            `SELECT
              COALESCE(AVG(rating), 0) AS avg_rating,
              COUNT(*) AS review_count
             FROM reviews
             WHERE product_id = ?`,
            [productId]
        )

        return NextResponse.json({
            reviews,
            avg_rating: Number(summary[0]?.avg_rating || 0),
            review_count: Number(summary[0]?.review_count || 0)
        })
    } catch (err) {
        console.error('Failed to fetch reviews', err)
        return NextResponse.json({ error: 'Unable to fetch reviews' }, { status: 500 })
    }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { user, error } = await requireAuth(req, ['customer', 'vendor', 'admin'])
    if (!user) return error as NextResponse

    const { id } = await context.params
    const productId = Number(id)
    if (Number.isNaN(productId)) {
        return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
    }

    const body = await req.json()
    const rating = Number(body?.rating)
    const title = String(body?.title || '').trim()
    const comment = String(body?.comment || '').trim()

    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    const conn = await getConnection()

    try {
        await conn.beginTransaction()

        const [existingReviews] = await conn.query<any[]>(
            'SELECT id FROM reviews WHERE product_id = ? AND user_id = ? LIMIT 1',
            [productId, user.id]
        )

        if (existingReviews.length) {
            await conn.execute(
                'UPDATE reviews SET rating = ?, title = ?, comment = ? WHERE id = ?',
                [rating, title || null, comment || null, existingReviews[0].id]
            )
        } else {
            await conn.execute(
                'INSERT INTO reviews (product_id, user_id, rating, title, comment) VALUES (?, ?, ?, ?, ?)',
                [productId, user.id, rating, title || null, comment || null]
            )
        }

        const [summaryRows] = await conn.query<any[]>(
            'SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS review_count FROM reviews WHERE product_id = ?',
            [productId]
        )

        const avgRating = Number(summaryRows[0]?.avg_rating || 0)
        const reviewCount = Number(summaryRows[0]?.review_count || 0)

        await conn.execute('UPDATE products SET avg_rating = ?, review_count = ? WHERE id = ?', [avgRating, reviewCount, productId])

        await conn.commit()
        return NextResponse.json({ ok: true, avg_rating: avgRating, review_count: reviewCount })
    } catch (err) {
        await conn.rollback()
        console.error('Failed to submit review', err)
        return NextResponse.json({ error: 'Unable to submit review' }, { status: 500 })
    } finally {
        conn.release()
    }
}
