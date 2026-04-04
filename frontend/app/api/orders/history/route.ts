import { NextRequest, NextResponse } from 'next/server'
import { RowDataPacket } from 'mysql2/promise'
import { query } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export const dynamic = 'force-dynamic'

type OrderRow = RowDataPacket & {
    id: number
    subtotal: number
    delivery_charge: number
    discount_amount: number
    total_amount: number
    status: string
    payment_method: string
    payment_status: string
    created_at: string
}

type ItemRow = RowDataPacket & {
    order_id: number
    id: number
    product_id: number
    variant_id: number | null
    vendor_id: number
    product_name: string
    color: string | null
    size: string | null
    quantity: number
    price_each: number
    discount_percent: number
    line_total: number
    platform_commission: number
    vendor_payout: number
    status: string
    mock_tracking_number: string | null
    return_reason: string | null
    refund_amount: number | null
    product_image: string | null
    vendor_name: string
    vendor_store_name: string
}

export async function GET(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    try {
        const orders = await query<OrderRow>(
            `SELECT id, subtotal, delivery_charge, discount_amount, total_amount, status, payment_method, payment_status, created_at
             FROM orders
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [user.id]
        )

        if (!orders.length) return NextResponse.json({ orders: [] })

        const orderIds = orders.map((o) => o.id)
        const items = await query<ItemRow>(
            `SELECT
                oi.order_id,
                oi.id,
                oi.product_id,
                oi.variant_id,
                oi.vendor_id,
                oi.product_name,
                oi.color,
                oi.size,
                oi.quantity,
                oi.price_each,
                oi.discount_percent,
                oi.line_total,
                oi.platform_commission,
                oi.vendor_payout,
                                COALESCE(
                                    CASE
                                        WHEN rr.status = 'requested' THEN 'return_requested'
                                        WHEN rr.status IN ('approved', 'completed') THEN 'returned'
                                        WHEN rr.status = 'refunded' THEN 'refunded'
                                        ELSE NULL
                                    END,
                                    oi.status
                                ) AS status,
                oi.mock_tracking_number,
                                COALESCE(rr.reason, oi.return_reason) AS return_reason,
                                CASE WHEN rr.status = 'refunded' THEN COALESCE(rr.refund_amount, oi.refund_amount) ELSE oi.refund_amount END AS refund_amount,
                p.image_url AS product_image,
                u.name AS vendor_name,
                COALESCE(v.store_name, u.name) AS vendor_store_name
               FROM order_items oi
               JOIN products p ON p.id = oi.product_id
               JOIN users u ON u.id = oi.vendor_id
               LEFT JOIN vendors v ON v.user_id = oi.vendor_id
                             LEFT JOIN returns_refunds rr ON rr.order_item_id = oi.id
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
