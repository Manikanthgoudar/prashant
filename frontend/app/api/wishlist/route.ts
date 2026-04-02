import { NextRequest, NextResponse } from 'next/server'
import { getConnection, query } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export const dynamic = 'force-dynamic'

async function ensureWishlist(userId: number): Promise<number> {
    const existing = await query<any>('SELECT id FROM wishlists WHERE user_id = ? LIMIT 1', [userId])
    if (existing.length) return Number(existing[0].id)

    const conn = await getConnection()
    try {
        const [insertResult] = await conn.execute<any>('INSERT INTO wishlists (user_id) VALUES (?)', [userId])
        return Number(insertResult.insertId)
    } finally {
        conn.release()
    }
}

async function getWishlistItems(userId: number) {
    return query<any>(
        `SELECT
          wi.id,
          wi.product_id,
          wi.variant_id,
          p.name AS product_name,
          p.price,
          p.discount_percent,
          p.image_url,
          p.avg_rating,
          p.review_count,
          pv.color,
          pv.size,
          COALESCE(pv.additional_price, 0) AS additional_price,
          ((p.price + COALESCE(pv.additional_price, 0)) - ((p.price + COALESCE(pv.additional_price, 0)) * p.discount_percent / 100)) AS effective_price
         FROM wishlists w
         JOIN wishlist_items wi ON wi.wishlist_id = w.id
         JOIN products p ON p.id = wi.product_id
         LEFT JOIN product_variants pv ON pv.id = wi.variant_id
         WHERE w.user_id = ?
         ORDER BY wi.created_at DESC`,
        [userId]
    )
}

export async function GET(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    try {
        await ensureWishlist(user.id)
        const items = await getWishlistItems(user.id)
        return NextResponse.json({ items })
    } catch (err) {
        console.error('Failed to fetch wishlist', err)
        return NextResponse.json({ error: 'Unable to fetch wishlist' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    const body = await req.json()
    const productId = Number(body?.product_id)
    const variantId = body?.variant_id === null || body?.variant_id === undefined ? null : Number(body.variant_id)

    if (Number.isNaN(productId) || (variantId !== null && Number.isNaN(variantId))) {
        return NextResponse.json({ error: 'Invalid wishlist payload' }, { status: 400 })
    }

    try {
        const wishlistId = await ensureWishlist(user.id)

        const existingRows = await query<any>(
            `SELECT id
             FROM wishlist_items
             WHERE wishlist_id = ?
               AND product_id = ?
               AND ((variant_id IS NULL AND ? IS NULL) OR variant_id = ?)
             LIMIT 1`,
            [wishlistId, productId, variantId, variantId]
        )

        if (!existingRows.length) {
            await query<any>('INSERT INTO wishlist_items (wishlist_id, product_id, variant_id) VALUES (?, ?, ?)', [
                wishlistId,
                productId,
                variantId
            ])
        }

        const items = await getWishlistItems(user.id)
        return NextResponse.json({ ok: true, items })
    } catch (err) {
        console.error('Failed to add wishlist item', err)
        return NextResponse.json({ error: 'Unable to update wishlist' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    try {
        const body = await req.json()
        const wishlistItemId = Number(body?.wishlist_item_id)
        const productId = body?.product_id ? Number(body.product_id) : null
        const variantId = body?.variant_id === null || body?.variant_id === undefined ? null : Number(body.variant_id)
        const wishlistId = await ensureWishlist(user.id)

        if (!Number.isNaN(wishlistItemId)) {
            await query<any>(
                `DELETE wi
                 FROM wishlist_items wi
                 JOIN wishlists w ON w.id = wi.wishlist_id
                 WHERE wi.id = ? AND w.user_id = ?`,
                [wishlistItemId, user.id]
            )
        } else if (productId !== null && !Number.isNaN(productId)) {
            await query<any>(
                `DELETE FROM wishlist_items
                 WHERE wishlist_id = ?
                   AND product_id = ?
                   AND ((variant_id IS NULL AND ? IS NULL) OR variant_id = ?)`,
                [wishlistId, productId, variantId, variantId]
            )
        } else {
            return NextResponse.json({ error: 'wishlist_item_id or product_id is required' }, { status: 400 })
        }

        const items = await getWishlistItems(user.id)
        return NextResponse.json({ ok: true, items })
    } catch (err) {
        console.error('Failed to delete wishlist item', err)
        return NextResponse.json({ error: 'Unable to update wishlist' }, { status: 500 })
    }
}
