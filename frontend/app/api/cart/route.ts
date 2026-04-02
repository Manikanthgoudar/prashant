import { NextRequest, NextResponse } from 'next/server'
import { getConnection, query } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export const dynamic = 'force-dynamic'

async function getCartRows(userId: number) {
    return query<any>(
        `SELECT
          ci.id,
          ci.user_id,
          ci.product_id,
          ci.variant_id,
          ci.quantity,
          p.name AS product_name,
          p.price,
          p.image_url,
          p.vendor_id,
          u.name AS vendor_name,
          COALESCE(v.store_name, u.name) AS vendor_store_name,
          p.discount_percent,
          pv.color,
          pv.size,
          COALESCE(pv.additional_price, 0) AS additional_price,
          ((p.price + COALESCE(pv.additional_price, 0)) - ((p.price + COALESCE(pv.additional_price, 0)) * p.discount_percent / 100)) AS effective_price
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
         JOIN users u ON u.id = p.vendor_id
         LEFT JOIN vendors v ON v.user_id = p.vendor_id
         LEFT JOIN product_variants pv ON pv.id = ci.variant_id
         WHERE ci.user_id = ?
         ORDER BY ci.updated_at DESC`,
        [userId]
    )
}

export async function GET(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    try {
        const items = await getCartRows(user.id)
        return NextResponse.json({ items })
    } catch (err) {
        console.error('Failed to fetch cart', err)
        return NextResponse.json({ error: 'Unable to fetch cart' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    const body = await req.json()
    const productId = Number(body?.product_id)
    const variantId = body?.variant_id === null || body?.variant_id === undefined ? null : Number(body.variant_id)
    const quantity = Math.max(1, Number(body?.quantity || 1))

    if (Number.isNaN(productId) || (variantId !== null && Number.isNaN(variantId))) {
        return NextResponse.json({ error: 'Invalid product or variant' }, { status: 400 })
    }

    const conn = await getConnection()
    try {
        await conn.beginTransaction()

        const [existingRows] = await conn.query<any[]>(
            `SELECT id, quantity
             FROM cart_items
             WHERE user_id = ?
               AND product_id = ?
               AND ((variant_id IS NULL AND ? IS NULL) OR variant_id = ?)
             LIMIT 1`,
            [user.id, productId, variantId, variantId]
        )

        if (existingRows.length) {
            const row = existingRows[0]
            const nextQty = Number(row.quantity) + quantity
            await conn.execute('UPDATE cart_items SET quantity = ? WHERE id = ?', [nextQty, row.id])
        } else {
            await conn.execute('INSERT INTO cart_items (user_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)', [
                user.id,
                productId,
                variantId,
                quantity
            ])
        }

        await conn.commit()
        const items = await getCartRows(user.id)
        return NextResponse.json({ ok: true, items })
    } catch (err) {
        await conn.rollback()
        console.error('Failed to add cart item', err)
        return NextResponse.json({ error: 'Unable to update cart' }, { status: 500 })
    } finally {
        conn.release()
    }
}

export async function PATCH(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    const body = await req.json()
    const cartItemId = Number(body?.cart_item_id)
    const quantity = Number(body?.quantity)

    if (Number.isNaN(cartItemId) || Number.isNaN(quantity) || quantity < 1) {
        return NextResponse.json({ error: 'Invalid cart item update' }, { status: 400 })
    }

    try {
        await query<any>('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?', [quantity, cartItemId, user.id])
        const items = await getCartRows(user.id)
        return NextResponse.json({ ok: true, items })
    } catch (err) {
        console.error('Failed to update cart quantity', err)
        return NextResponse.json({ error: 'Unable to update cart' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    const { searchParams } = new URL(req.url)
    const clear = searchParams.get('clear') === 'true'

    try {
        if (clear) {
            await query<any>('DELETE FROM cart_items WHERE user_id = ?', [user.id])
            return NextResponse.json({ ok: true, items: [] })
        }

        const body = await req.json()
        const cartItemId = Number(body?.cart_item_id)
        if (Number.isNaN(cartItemId)) {
            return NextResponse.json({ error: 'cart_item_id is required' }, { status: 400 })
        }

        await query<any>('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [cartItemId, user.id])
        const items = await getCartRows(user.id)
        return NextResponse.json({ ok: true, items })
    } catch (err) {
        console.error('Failed to delete cart item', err)
        return NextResponse.json({ error: 'Unable to update cart' }, { status: 500 })
    }
}
