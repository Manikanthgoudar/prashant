import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const { user, error } = await requireAuth(req, ['admin'])
    if (!user) return error as NextResponse

    const conn = await getConnection()
    try {
        const [summaryRows] = await conn.query<any[]>(
            `SELECT
              (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers,
              (SELECT COUNT(*) FROM users WHERE role = 'vendor') AS vendors,
              (SELECT COUNT(*) FROM products) AS products,
              (SELECT COUNT(*) FROM orders) AS orders,
              (SELECT COALESCE(SUM(gross_amount), 0) FROM transactions WHERE transaction_type = 'payment' AND status = 'success') AS gross_sales,
              (SELECT COALESCE(SUM(commission_amount), 0) FROM transactions WHERE transaction_type = 'commission' AND status = 'success') AS commission,
              (SELECT COALESCE(SUM(payout_amount), 0) FROM transactions WHERE transaction_type = 'vendor_payout' AND status = 'success') AS vendor_payout,
                            (SELECT COALESCE(SUM(r.refund_amount), 0)
                                 FROM (
                                     SELECT order_item_id, MAX(refund_amount) AS refund_amount
                                     FROM transactions
                                     WHERE transaction_type = 'refund' AND status = 'success'
                                     GROUP BY order_item_id
                                 ) r) AS refunds`
        )

        const [categoryBreakdown] = await conn.query<any[]>(
            `SELECT c.name, COUNT(p.id) AS product_count
             FROM categories c
             LEFT JOIN products p ON p.category_id = c.id
             GROUP BY c.id
             ORDER BY product_count DESC, c.name ASC`
        )

        const [recentTransactions] = await conn.query<any[]>(
            `SELECT
              t.id,
              t.order_id,
              t.order_item_id,
              t.transaction_type,
              t.gross_amount,
              t.commission_amount,
              t.payout_amount,
              t.refund_amount,
              t.payment_method,
              t.reference,
              t.status,
              t.created_at,
              cu.name AS customer_name,
              vu.name AS vendor_name,
              COALESCE(v.store_name, vu.name) AS vendor_store_name
             FROM transactions t
             LEFT JOIN users cu ON cu.id = t.customer_id
             LEFT JOIN users vu ON vu.id = t.vendor_id
             LEFT JOIN vendors v ON v.user_id = t.vendor_id
                         WHERE t.status = 'success'
                             AND (
                                 t.transaction_type <> 'refund'
                                 OR t.id = (
                                     SELECT MAX(t2.id)
                                     FROM transactions t2
                                     WHERE t2.transaction_type = 'refund'
                                         AND t2.status = 'success'
                                         AND t2.order_item_id <=> t.order_item_id
                                 )
                             )
             ORDER BY t.created_at DESC
             LIMIT 100`
        )

        const [monthlyRows] = await conn.query<any[]>(
            `SELECT
              DATE_FORMAT(created_at, '%Y-%m') AS month,
              SUM(CASE WHEN transaction_type = 'payment' THEN gross_amount ELSE 0 END) AS sales,
              SUM(CASE WHEN transaction_type = 'commission' THEN commission_amount ELSE 0 END) AS commission,
              SUM(CASE WHEN transaction_type = 'vendor_payout' THEN payout_amount ELSE 0 END) AS payout,
              SUM(CASE WHEN transaction_type = 'refund' THEN refund_amount ELSE 0 END) AS refunds
             FROM transactions
             WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)
                             AND status = 'success'
             GROUP BY DATE_FORMAT(created_at, '%Y-%m')
             ORDER BY month ASC`
        )

        const [reversalGapRows] = await conn.query<any[]>(
            `SELECT
              COALESCE((SELECT SUM(oi.platform_commission) FROM order_items oi WHERE oi.status = 'refunded'), 0) AS refunded_commission,
              COALESCE((SELECT ABS(SUM(t.commission_amount))
                        FROM transactions t
                        WHERE t.transaction_type = 'commission' AND t.status = 'success' AND t.commission_amount < 0), 0) AS reversed_commission,
              COALESCE((SELECT SUM(oi.vendor_payout) FROM order_items oi WHERE oi.status = 'refunded'), 0) AS refunded_payout,
              COALESCE((SELECT ABS(SUM(t.payout_amount))
                        FROM transactions t
                        WHERE t.transaction_type = 'vendor_payout' AND t.status = 'success' AND t.payout_amount < 0), 0) AS reversed_payout`
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

        summary.commission = Number(summary.commission || 0) - missingCommissionReversal
        summary.vendor_payout = Number(summary.vendor_payout || 0) - missingPayoutReversal

        return NextResponse.json({
            summary,
            category_breakdown: categoryBreakdown,
            recent_transactions: recentTransactions,
            monthly_trend: monthlyRows
        })
    } catch (err) {
        console.error('Failed to load admin dashboard', err)
        return NextResponse.json({ error: 'Unable to load admin dashboard' }, { status: 500 })
    } finally {
        conn.release()
    }
}
