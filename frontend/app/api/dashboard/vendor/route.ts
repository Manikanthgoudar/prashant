import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const { user, error } = await requireAuth(req, ['vendor'])
    if (!user) return error as NextResponse

    const conn = await getConnection()
    try {
        const [summaryRows] = await conn.query<any[]>(
            `SELECT
               COALESCE(SUM(oi.line_total), 0) AS gross_sales,
               COALESCE(SUM(oi.platform_commission), 0) AS platform_commission,
               COALESCE(SUM(oi.vendor_payout), 0) AS net_payout,
               COALESCE(SUM(oi.refund_amount), 0) AS refunds,
               COUNT(DISTINCT oi.order_id) AS orders,
               SUM(CASE WHEN oi.status IN ('placed', 'processing') THEN 1 ELSE 0 END) AS pending_items,
               SUM(CASE WHEN oi.status = 'return_requested' THEN 1 ELSE 0 END) AS return_requests
             FROM order_items oi
             WHERE oi.vendor_id = ?`,
            [user.id]
        )

        const [orderItems] = await conn.query<any[]>(
            `SELECT
               oi.id,
               oi.order_id,
               oi.product_id,
               oi.product_name,
               oi.quantity,
               oi.line_total,
               oi.platform_commission,
               oi.vendor_payout,
               oi.status,
               oi.mock_tracking_number,
               oi.return_reason,
               oi.refund_amount,
               o.created_at,
               o.payment_method,
               o.payment_status,
               u.name AS customer_name,
               u.email AS customer_email
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             JOIN users u ON u.id = o.user_id
             WHERE oi.vendor_id = ?
             ORDER BY o.created_at DESC
             LIMIT 200`,
            [user.id]
        )

        const [transactions] = await conn.query<any[]>(
            `SELECT
               id,
               order_id,
               order_item_id,
               transaction_type,
               gross_amount,
               commission_amount,
               payout_amount,
               refund_amount,
               payment_method,
               reference,
               status,
               created_at
             FROM transactions
             WHERE vendor_id = ?
             ORDER BY created_at DESC
             LIMIT 300`,
            [user.id]
        )

        const [returnsRows] = await conn.query<any[]>(
            `SELECT
               rr.id,
               rr.order_item_id,
               rr.reason,
               rr.status,
               rr.refund_amount,
               rr.created_at,
               rr.updated_at,
               oi.order_id,
               oi.product_name,
               oi.quantity,
               oi.line_total,
               u.name AS customer_name,
               u.email AS customer_email
             FROM returns_refunds rr
             JOIN order_items oi ON oi.id = rr.order_item_id
             JOIN orders o ON o.id = oi.order_id
             JOIN users u ON u.id = o.user_id
             WHERE oi.vendor_id = ?
             ORDER BY rr.created_at DESC`,
            [user.id]
        )

        const [monthlyRows] = await conn.query<any[]>(
            `SELECT
               DATE_FORMAT(o.created_at, '%Y-%m') AS month,
               SUM(oi.line_total) AS sales,
               SUM(oi.platform_commission) AS commission,
               SUM(oi.vendor_payout) AS payout,
               SUM(oi.refund_amount) AS refunds,
               COUNT(DISTINCT oi.order_id) AS orders
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.vendor_id = ?
               AND o.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)
             GROUP BY DATE_FORMAT(o.created_at, '%Y-%m')
             ORDER BY month ASC`,
            [user.id]
        )

        const [statusBreakdown] = await conn.query<any[]>(
            `SELECT status, COUNT(*) AS count
             FROM order_items
             WHERE vendor_id = ?
             GROUP BY status
             ORDER BY count DESC`,
            [user.id]
        )

        const [lowStockProducts] = await conn.query<any[]>(
            `SELECT id, name, stock, price, discount_percent
             FROM products
             WHERE vendor_id = ?
             ORDER BY stock ASC, id DESC
             LIMIT 50`,
            [user.id]
        )

        return NextResponse.json({
            summary: summaryRows[0] || {},
            order_items: orderItems,
            transactions,
            returns_refunds: returnsRows,
            monthly_trend: monthlyRows,
            status_breakdown: statusBreakdown,
            low_stock_products: lowStockProducts
        })
    } catch (err) {
        console.error('Failed to load vendor dashboard', err)
        return NextResponse.json({ error: 'Unable to load vendor dashboard' }, { status: 500 })
    } finally {
        conn.release()
    }
}
