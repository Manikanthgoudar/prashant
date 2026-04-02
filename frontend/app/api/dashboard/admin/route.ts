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
              (SELECT COALESCE(SUM(refund_amount), 0) FROM transactions WHERE transaction_type = 'refund' AND status = 'success') AS refunds`
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
             GROUP BY DATE_FORMAT(created_at, '%Y-%m')
             ORDER BY month ASC`
        )

        return NextResponse.json({
            summary: summaryRows[0] || {},
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
