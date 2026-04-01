import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { tokenFromAuthHeader, verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type OrderRow = {
    id: number
    total_amount: number
    status: string
    created_at: string
}

type ItemRow = {
    order_id: number
    product_id: number
    quantity: number
    price_each: number
    color: string | null
    product_name: string
    product_image: string | null
}

export async function GET(req: NextRequest) {
    const token = tokenFromAuthHeader(req.headers)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const orders = await query<any>(
            'SELECT id, total_amount, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC',
            [payload.id]
        )

        if (!orders.length) return NextResponse.json({ orders: [] })

        const orderIds = orders.map((o) => o.id)
        const items = await query<any>(
            `SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_each, oi.color, p.name as product_name, p.image_url as product_image
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id IN (${orderIds.map(() => '?').join(',')})`,
            orderIds
        )

        const itemsByOrder = new Map<number, ItemRow[]>()
        for (const item of items) {
            const arr = itemsByOrder.get(item.order_id) || []
            arr.push(item)
            itemsByOrder.set(item.order_id, arr)
        }

        const result = orders.map((o) => ({
            ...o,
            items: itemsByOrder.get(o.id) || []
        }))

        return NextResponse.json({ orders: result })
    } catch (err) {
        console.error('Failed to load order history', err)
        return NextResponse.json({ error: 'Unable to load order history' }, { status: 500 })
    }
}
