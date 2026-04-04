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
                             (SELECT COALESCE(SUM(t.gross_amount), 0)
                                    FROM transactions t
                                 WHERE t.vendor_id = ?
                                     AND t.transaction_type = 'payment'
                                     AND t.status = 'success') AS gross_sales,
                             (SELECT COALESCE(SUM(t.commission_amount), 0)
                                    FROM transactions t
                                 WHERE t.vendor_id = ?
                                     AND t.transaction_type = 'commission'
                                     AND t.status = 'success') AS platform_commission,
                             (SELECT COALESCE(SUM(t.payout_amount), 0)
                                    FROM transactions t
                                 WHERE t.vendor_id = ?
                                     AND t.transaction_type = 'vendor_payout'
                                     AND t.status = 'success') AS net_payout,
                             (SELECT COALESCE(SUM(t.refund_amount), 0)
                                    FROM (
                                        SELECT order_item_id, MAX(refund_amount) AS refund_amount
                                        FROM transactions
                                        WHERE vendor_id = ?
                                            AND transaction_type = 'refund'
                                            AND status = 'success'
                                        GROUP BY order_item_id
                                    ) t) AS refunds,
               COUNT(DISTINCT oi.order_id) AS orders,
                             COALESCE(SUM(CASE WHEN oi.status IN ('placed', 'processing') THEN 1 ELSE 0 END), 0) AS pending_items,
                             COALESCE(SUM(CASE WHEN oi.status = 'return_requested' THEN 1 ELSE 0 END), 0) AS return_requests
             FROM order_items oi
             WHERE oi.vendor_id = ?`,
                        [user.id, user.id, user.id, user.id, user.id]
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
                             AND status = 'success'
                             AND (
                                 transaction_type <> 'refund'
                                 OR id = (
                                     SELECT MAX(t2.id)
                                     FROM transactions t2
                                     WHERE t2.vendor_id = transactions.vendor_id
                                         AND t2.transaction_type = 'refund'
                                         AND t2.status = 'success'
                                         AND t2.order_item_id <=> transactions.order_item_id
                                 )
                             )
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
                             DATE_FORMAT(created_at, '%Y-%m') AS month,
                             SUM(CASE WHEN transaction_type = 'payment' THEN gross_amount ELSE 0 END) AS sales,
                             SUM(CASE WHEN transaction_type = 'commission' THEN commission_amount ELSE 0 END) AS commission,
                             SUM(CASE WHEN transaction_type = 'vendor_payout' THEN payout_amount ELSE 0 END) AS payout,
                             SUM(CASE WHEN transaction_type = 'refund' THEN refund_amount ELSE 0 END) AS refunds,
                             COUNT(DISTINCT order_id) AS orders
                         FROM transactions
                         WHERE vendor_id = ?
                             AND status = 'success'
                             AND created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)
                         GROUP BY DATE_FORMAT(created_at, '%Y-%m')
             ORDER BY month ASC`,
            [user.id]
        )

                const [reversalGapRows] = await conn.query<any[]>(
                        `SELECT
                            COALESCE((SELECT SUM(oi.platform_commission)
                                                FROM order_items oi
                                                WHERE oi.vendor_id = ? AND oi.status = 'refunded'), 0) AS refunded_commission,
                            COALESCE((SELECT ABS(SUM(t.commission_amount))
                                                FROM transactions t
                                                WHERE t.vendor_id = ?
                                                    AND t.transaction_type = 'commission'
                                                    AND t.status = 'success'
                                                    AND t.commission_amount < 0), 0) AS reversed_commission,
                            COALESCE((SELECT SUM(oi.vendor_payout)
                                                FROM order_items oi
                                                WHERE oi.vendor_id = ? AND oi.status = 'refunded'), 0) AS refunded_payout,
                            COALESCE((SELECT ABS(SUM(t.payout_amount))
                                                FROM transactions t
                                                WHERE t.vendor_id = ?
                                                    AND t.transaction_type = 'vendor_payout'
                                                    AND t.status = 'success'
                                                    AND t.payout_amount < 0), 0) AS reversed_payout`,
                        [user.id, user.id, user.id, user.id]
                )

                const summary = { ...(summaryRows[0] || {}) }
                const reversalGap = reversalGapRows[0] || {}
                const missingCommissionReversal = Math.max(
                        0,
                        Number(reversalGap.refunded_commission || 0) - Number(reversalGap.reversed_commission || 0)
                )
                const missingPayoutReversal = Math.max(
                        0,
                        Number(reversalGap.refunded_payout || 0) - Number(reversalGap.reversed_payout || 0)
                )

                summary.platform_commission = Number(summary.platform_commission || 0) - missingCommissionReversal
                summary.net_payout = Number(summary.net_payout || 0) - missingPayoutReversal

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
            summary,
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
