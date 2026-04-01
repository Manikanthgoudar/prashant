import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/db'
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { tokenFromAuthHeader, verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type OrderItemInput = { productId: number; quantity: number; color?: string }

type ProductRow = RowDataPacket & { id: number; price: number; stock: number }

export async function POST(req: NextRequest) {
    const body = await req.json()
    const items: OrderItemInput[] = Array.isArray(body?.items) ? body.items : []

    let userId = body?.userId ?? null
    const token = tokenFromAuthHeader(req.headers)
    if (token) {
        const payload = await verifyToken(token)
        if (payload) userId = payload.id
    }

    if (!items.length) {
        return NextResponse.json({ error: 'No order items provided' }, { status: 400 })
    }

    const productIds = [...new Set(items.map((i) => Number(i.productId)).filter((v) => !Number.isNaN(v)))]
    if (!productIds.length) return NextResponse.json({ error: 'Invalid product ids' }, { status: 400 })

    const conn = await getConnection()

    try {
        await conn.beginTransaction()

        const [productRows] = await conn.query<ProductRow[]>(
            `SELECT id, price, stock FROM products WHERE id IN (${productIds.map(() => '?').join(',')})`,
            productIds
        )
        const priceById = new Map(productRows.map((p) => [p.id, p.price]))

        let total = 0
        for (const item of items) {
            const price = priceById.get(item.productId)
            if (price === undefined) throw new Error(`Product ${item.productId} not found`)
            if (!item.quantity || item.quantity < 1) throw new Error(`Invalid quantity for ${item.productId}`)
            total += price * item.quantity
        }

        const [orderResult] = await conn.execute<ResultSetHeader>(
            'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)',
            [userId, total, 'created']
        )

        const orderId = orderResult.insertId

        for (const item of items) {
            const price = priceById.get(item.productId) as number
            await conn.execute(
                'INSERT INTO order_items (order_id, product_id, quantity, price_each, color) VALUES (?, ?, ?, ?, ?)',
                [orderId, item.productId, item.quantity, price, item.color || null]
            )
        }

        await conn.commit()
        return NextResponse.json({ orderId, total, created_at: new Date().toISOString() })
    } catch (err) {
        await conn.rollback()
        console.error('Failed to create order', err)
        return NextResponse.json({ error: 'Unable to create order' }, { status: 500 })
    } finally {
        conn.release()
    }
}
