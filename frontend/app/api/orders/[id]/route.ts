import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

type OrderRow = {
    id: number
    user_id: number | null
    total_amount: number
    status: string
    created_at: string
}

type OrderItemRow = {
    product_id: number
    quantity: number
    price_each: number
    color: string | null
    product_name: string
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    const orderId = Number(id)
    if (Number.isNaN(orderId)) return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })

    try {
        const orders = await query<any>('SELECT id, user_id, total_amount, status, created_at FROM orders WHERE id = ?', [orderId])
        const order = orders[0]
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

        const items = await query<any>(
            `SELECT oi.product_id, oi.quantity, oi.price_each, oi.color, p.name as product_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
            [orderId]
        )

        return NextResponse.json({ ...order, items })
    } catch (err) {
        console.error('Failed to fetch order', err)
        return NextResponse.json({ error: 'Unable to fetch order' }, { status: 500 })
    }
}
