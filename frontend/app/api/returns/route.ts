import { NextRequest, NextResponse } from 'next/server'
import { getConnection, query } from '@/lib/db'
import { deriveOrderStatus } from '@/lib/marketplace'
import { requireAuth } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    try {
        let rows: any[] = []
        if (user.role === 'admin') {
            rows = await query<any>(
                `SELECT rr.*, oi.order_id, oi.vendor_id, oi.product_name, oi.quantity, oi.line_total,
                        cu.name AS customer_name, cu.email AS customer_email,
                        vu.name AS vendor_name, COALESCE(v.store_name, vu.name) AS vendor_store_name
                 FROM returns_refunds rr
                 JOIN order_items oi ON oi.id = rr.order_item_id
                 JOIN orders o ON o.id = oi.order_id
                 JOIN users cu ON cu.id = o.user_id
                 JOIN users vu ON vu.id = oi.vendor_id
                 LEFT JOIN vendors v ON v.user_id = oi.vendor_id
                 ORDER BY rr.created_at DESC`
            )
        } else if (user.role === 'vendor') {
            rows = await query<any>(
                `SELECT rr.*, oi.order_id, oi.vendor_id, oi.product_name, oi.quantity, oi.line_total,
                        cu.name AS customer_name, cu.email AS customer_email
                 FROM returns_refunds rr
                 JOIN order_items oi ON oi.id = rr.order_item_id
                 JOIN orders o ON o.id = oi.order_id
                 JOIN users cu ON cu.id = o.user_id
                 WHERE oi.vendor_id = ?
                 ORDER BY rr.created_at DESC`,
                [user.id]
            )
        } else {
            rows = await query<any>(
                `SELECT rr.*, oi.order_id, oi.vendor_id, oi.product_name, oi.quantity, oi.line_total
                 FROM returns_refunds rr
                 JOIN order_items oi ON oi.id = rr.order_item_id
                 WHERE rr.user_id = ?
                 ORDER BY rr.created_at DESC`,
                [user.id]
            )
        }

        return NextResponse.json({ returns: rows })
    } catch (err) {
        console.error('Failed to fetch returns', err)
        return NextResponse.json({ error: 'Unable to fetch returns' }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    const body = await req.json()
    const returnId = Number(body?.return_id)
    const nextStatus = String(body?.status || '').toLowerCase()

    if (Number.isNaN(returnId) || !nextStatus) {
        return NextResponse.json({ error: 'return_id and status are required' }, { status: 400 })
    }

    const allowedStatuses = new Set(['requested', 'approved', 'rejected', 'completed', 'refunded'])
    if (!allowedStatuses.has(nextStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const conn = await getConnection()
    try {
        await conn.beginTransaction()

        const [rows] = await conn.query<any[]>(
            `SELECT rr.*, oi.order_id, oi.id AS item_id, oi.vendor_id, oi.line_total, oi.status AS item_status, o.user_id
             FROM returns_refunds rr
             JOIN order_items oi ON oi.id = rr.order_item_id
             JOIN orders o ON o.id = oi.order_id
             WHERE rr.id = ?
             LIMIT 1
             FOR UPDATE`,
            [returnId]
        )

        const returnRow = rows[0]
        if (!returnRow) {
            await conn.rollback()
            return NextResponse.json({ error: 'Return request not found' }, { status: 404 })
        }

        if (user.role === 'vendor' && Number(returnRow.vendor_id) !== user.id) {
            await conn.rollback()
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (user.role === 'customer' && Number(returnRow.user_id) !== user.id) {
            await conn.rollback()
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (user.role === 'customer' && nextStatus !== 'requested') {
            await conn.rollback()
            return NextResponse.json({ error: 'Customer cannot directly change return status to this value' }, { status: 403 })
        }

        await conn.execute('UPDATE returns_refunds SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextStatus, returnId])

        let nextItemStatus = returnRow.item_status
        if (nextStatus === 'approved') nextItemStatus = 'returned'
        if (nextStatus === 'completed') nextItemStatus = 'returned'
        if (nextStatus === 'refunded') nextItemStatus = 'refunded'

        if (nextItemStatus !== returnRow.item_status) {
            await conn.execute('UPDATE order_items SET status = ?, refund_amount = ? WHERE id = ?', [
                nextItemStatus,
                nextStatus === 'refunded' ? Number(returnRow.line_total) : Number(returnRow.refund_amount || 0),
                returnRow.item_id
            ])
        }

        if (nextStatus === 'refunded') {
            await conn.execute('UPDATE returns_refunds SET refund_amount = ? WHERE id = ?', [Number(returnRow.line_total), returnId])
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
                    returnRow.order_id,
                    returnRow.item_id,
                    returnRow.user_id,
                    returnRow.vendor_id,
                    'refund',
                    Number(returnRow.line_total),
                    0,
                    0,
                    Number(returnRow.line_total),
                    null,
                    `RET-REFUND-${returnRow.order_id}-${returnRow.item_id}`,
                    'success'
                ]
            )
        }

        const [itemRows] = await conn.query<any[]>('SELECT status FROM order_items WHERE order_id = ?', [returnRow.order_id])
        const overallStatus = deriveOrderStatus(itemRows.map((item) => item.status))
        await conn.execute('UPDATE orders SET status = ? WHERE id = ?', [overallStatus, returnRow.order_id])

        await conn.commit()
        return NextResponse.json({ ok: true, status: nextStatus, order_status: overallStatus })
    } catch (err) {
        await conn.rollback()
        console.error('Failed to update return request', err)
        return NextResponse.json({ error: 'Unable to update return request' }, { status: 500 })
    } finally {
        conn.release()
    }
}
