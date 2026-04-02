import { NextRequest, NextResponse } from 'next/server'
import { getConnection, query } from '@/lib/db'
import { CANCELLABLE_STATUSES, deriveOrderStatus, RETURNABLE_STATUSES } from '@/lib/marketplace'
import { requireAuth } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    const { id } = await context.params
    const orderId = Number(id)
    if (Number.isNaN(orderId)) return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })

    try {
        const orders = await query<any>(
            `SELECT o.*, u.name AS customer_name, u.email AS customer_email,
                    a.label AS address_label, a.full_name, a.phone, a.line1, a.line2, a.city, a.state, a.pincode, a.country
             FROM orders o
             JOIN users u ON u.id = o.user_id
             LEFT JOIN addresses a ON a.id = o.address_id
             WHERE o.id = ?`,
            [orderId]
        )
        const order = orders[0]
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

        if (user.role === 'customer' && Number(order.user_id) !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const items = await query<any>(
            `SELECT
              oi.id,
              oi.order_id,
              oi.product_id,
              oi.variant_id,
              oi.vendor_id,
              oi.product_name,
              oi.color,
              oi.size,
              oi.quantity,
              oi.price_each,
              oi.discount_percent,
              oi.line_subtotal,
              oi.line_total,
              oi.platform_commission,
              oi.vendor_payout,
              oi.status,
              oi.mock_tracking_number,
              oi.return_reason,
              oi.refund_amount,
              p.image_url AS product_image,
              u.name AS vendor_name,
              COALESCE(v.store_name, u.name) AS vendor_store_name
             FROM order_items oi
             JOIN products p ON p.id = oi.product_id
             JOIN users u ON u.id = oi.vendor_id
             LEFT JOIN vendors v ON v.user_id = oi.vendor_id
             WHERE oi.order_id = ?
             ORDER BY oi.id`,
            [orderId]
        )

        const visibleItems =
            user.role === 'vendor' ? items.filter((item: any) => Number(item.vendor_id) === user.id) : items

        if (user.role === 'vendor' && !visibleItems.length) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const canCancel = visibleItems.every((item: any) => CANCELLABLE_STATUSES.has(item.status))

        return NextResponse.json({ ...order, items: visibleItems, can_cancel: canCancel })
    } catch (err) {
        console.error('Failed to fetch order', err)
        return NextResponse.json({ error: 'Unable to fetch order' }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    const { id } = await context.params
    const orderId = Number(id)
    if (Number.isNaN(orderId)) return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })

    const body = await req.json()
    const action = String(body?.action || '').toLowerCase()
    const itemId = body?.item_id ? Number(body.item_id) : null

    const conn = await getConnection()
    try {
        await conn.beginTransaction()

        const [orderRows] = await conn.query<any[]>(
            'SELECT id, user_id, payment_status, payment_method FROM orders WHERE id = ? FOR UPDATE',
            [orderId]
        )
        if (!orderRows.length) {
            await conn.rollback()
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        const order = orderRows[0]
        const [allItems] = await conn.query<any[]>('SELECT * FROM order_items WHERE order_id = ? FOR UPDATE', [orderId])
        if (!allItems.length) {
            await conn.rollback()
            return NextResponse.json({ error: 'Order items not found' }, { status: 404 })
        }

        if (action === 'update_status') {
            if (user.role !== 'vendor' && user.role !== 'admin') {
                await conn.rollback()
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }

            const nextStatus = String(body?.status || '').toLowerCase()
            const allowed = new Set([
                'placed',
                'processing',
                'shipped',
                'delivered',
                'completed',
                'cancelled',
                'return_requested',
                'returned',
                'refunded'
            ])

            if (!itemId || !allowed.has(nextStatus)) {
                await conn.rollback()
                return NextResponse.json({ error: 'item_id and valid status are required' }, { status: 400 })
            }

            const item = allItems.find((row) => Number(row.id) === itemId)
            if (!item) {
                await conn.rollback()
                return NextResponse.json({ error: 'Item not found' }, { status: 404 })
            }

            if (user.role === 'vendor' && Number(item.vendor_id) !== user.id) {
                await conn.rollback()
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }

            await conn.execute('UPDATE order_items SET status = ? WHERE id = ?', [nextStatus, itemId])
        } else if (action === 'cancel') {
            if (user.role !== 'customer' || Number(order.user_id) !== user.id) {
                await conn.rollback()
                return NextResponse.json({ error: 'Only customer can cancel this order' }, { status: 403 })
            }

            if (!allItems.every((item) => CANCELLABLE_STATUSES.has(item.status))) {
                await conn.rollback()
                return NextResponse.json({ error: 'Order cannot be cancelled after shipping' }, { status: 400 })
            }

            await conn.execute('UPDATE order_items SET status = ? WHERE order_id = ?', ['cancelled', orderId])

            if (order.payment_status === 'paid') {
                for (const item of allItems) {
                    await conn.execute(
                        `INSERT INTO transactions (
                          order_id,
                          order_item_id,
                          customer_id,
                          vendor_id,
                          transaction_type,
                          gross_amount,
                          commission_amount,
                          payout_amount,
                          refund_amount,
                          payment_method,
                          reference,
                          status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            orderId,
                            item.id,
                            user.id,
                            item.vendor_id,
                            'refund',
                            Number(item.line_total),
                            0,
                            0,
                            Number(item.line_total),
                            order.payment_method,
                            `REFUND-${orderId}-${item.id}`,
                            'success'
                        ]
                    )
                }

                await conn.execute('UPDATE orders SET payment_status = ? WHERE id = ?', ['refunded', orderId])
            }
        } else if (action === 'request_return') {
            if (user.role !== 'customer' || Number(order.user_id) !== user.id) {
                await conn.rollback()
                return NextResponse.json({ error: 'Only customer can request return' }, { status: 403 })
            }

            if (!itemId) {
                await conn.rollback()
                return NextResponse.json({ error: 'item_id is required for return request' }, { status: 400 })
            }

            const item = allItems.find((row) => Number(row.id) === itemId)
            if (!item) {
                await conn.rollback()
                return NextResponse.json({ error: 'Item not found' }, { status: 404 })
            }

            if (!RETURNABLE_STATUSES.has(item.status)) {
                await conn.rollback()
                return NextResponse.json({ error: 'Return not allowed for this item status' }, { status: 400 })
            }

            const reason = String(body?.reason || 'Customer requested return').trim()

            await conn.execute('UPDATE order_items SET status = ?, return_reason = ? WHERE id = ?', ['return_requested', reason, itemId])
            await conn.execute(
                `INSERT INTO returns_refunds (order_item_id, user_id, reason, status, refund_amount)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE reason = VALUES(reason), status = VALUES(status), updated_at = CURRENT_TIMESTAMP`,
                [itemId, user.id, reason, 'requested', Number(item.line_total)]
            )
        } else {
            await conn.rollback()
            return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
        }

        const [latestItemRows] = await conn.query<any[]>('SELECT status FROM order_items WHERE order_id = ?', [orderId])
        const overall = deriveOrderStatus(latestItemRows.map((item) => item.status))
        await conn.execute('UPDATE orders SET status = ? WHERE id = ?', [overall, orderId])

        await conn.commit()
        return NextResponse.json({ ok: true, status: overall })
    } catch (err) {
        await conn.rollback()
        console.error('Failed to update order', err)
        return NextResponse.json({ error: 'Unable to update order' }, { status: 500 })
    } finally {
        conn.release()
    }
}
