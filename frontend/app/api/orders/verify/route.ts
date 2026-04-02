import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req)
  if (!user) return error as NextResponse

  const body = await req.json()
  const orderId = Number(body?.order_id)
  const razorpayOrderId = String(body?.razorpay_order_id || '').trim()
  const razorpayPaymentId = String(body?.razorpay_payment_id || '').trim()
  const razorpaySignature = String(body?.razorpay_signature || '').trim()

  if (Number.isNaN(orderId) || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return NextResponse.json({ error: 'order_id, razorpay_order_id, razorpay_payment_id and razorpay_signature are required' }, { status: 400 })
  }

  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Razorpay is not configured' }, { status: 500 })
  }

  const conn = await getConnection()
  try {
    await conn.beginTransaction()

    const [orderRows] = await conn.query<any[]>(
      `SELECT id, user_id, payment_provider, payment_status, payment_method, razorpay_order_id
       FROM orders
       WHERE id = ?
       FOR UPDATE`,
      [orderId]
    )

    const order = orderRows[0]
    if (!order) {
      await conn.rollback()
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (user.role === 'customer' && Number(order.user_id) !== user.id) {
      await conn.rollback()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (order.payment_provider !== 'razorpay') {
      await conn.rollback()
      return NextResponse.json({ error: 'This order is not using Razorpay' }, { status: 400 })
    }

    if (!order.razorpay_order_id || String(order.razorpay_order_id) !== razorpayOrderId) {
      await conn.rollback()
      return NextResponse.json({ error: 'Razorpay order id mismatch' }, { status: 400 })
    }

    const payload = `${razorpayOrderId}|${razorpayPaymentId}`
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    const isSignatureValid =
      expectedSignature.length === razorpaySignature.length &&
      crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpaySignature))

    if (!isSignatureValid) {
      await conn.execute('UPDATE orders SET payment_status = ?, payment_reference = ? WHERE id = ?', [
        'failed',
        razorpayPaymentId,
        orderId
      ])

      await conn.execute(
        `UPDATE transactions
         SET status = CASE WHEN transaction_type = 'payment' THEN 'failed' ELSE status END,
             reference = CASE WHEN transaction_type = 'payment' THEN ? ELSE reference END
         WHERE order_id = ?`,
        [razorpayPaymentId, orderId]
      )

      await conn.commit()
      return NextResponse.json({ error: 'Payment signature verification failed' }, { status: 400 })
    }

    if (order.payment_status === 'paid') {
      await conn.commit()
      return NextResponse.json({ ok: true, already_paid: true, order_id: orderId, payment_reference: razorpayPaymentId })
    }

    await conn.execute('UPDATE orders SET payment_status = ?, payment_reference = ? WHERE id = ?', [
      'paid',
      razorpayPaymentId,
      orderId
    ])

    await conn.execute(
      `UPDATE transactions
       SET status = 'success',
           reference = CASE
             WHEN transaction_type = 'payment' THEN ?
             WHEN transaction_type = 'commission' THEN ?
             WHEN transaction_type = 'vendor_payout' THEN ?
             ELSE reference
           END
       WHERE order_id = ?
         AND transaction_type IN ('payment', 'commission', 'vendor_payout')`,
      [razorpayPaymentId, `${razorpayPaymentId}-COMM`, `${razorpayPaymentId}-PAYOUT`, orderId]
    )

    await conn.commit()

    return NextResponse.json({
      ok: true,
      order_id: orderId,
      payment_status: 'paid',
      payment_reference: razorpayPaymentId,
      payment_method: order.payment_method
    })
  } catch (err) {
    await conn.rollback()
    console.error('Failed to verify Razorpay payment', err)
    return NextResponse.json({ error: 'Unable to verify payment' }, { status: 500 })
  } finally {
    conn.release()
  }
}
