import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/db'
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getCommissionRatePercent, getDeliveryCharge, makeTrackingNumber } from '@/lib/marketplace'
import { requireAuth } from '@/lib/session'

export const dynamic = 'force-dynamic'

type OrderItemInput = { product_id: number; variant_id?: number | null; quantity: number }

type ProductRow = RowDataPacket & {
    id: number
    vendor_id: number
    name: string
    price: number
    discount_percent: number
    stock: number
    commission_rate: number
}

type VariantRow = RowDataPacket & {
    id: number
    product_id: number
    color: string | null
    size: string | null
    additional_price: number
    stock: number
}

const PAYMENT_METHODS = new Set(['card', 'upi', 'netbanking', 'wallet', 'cod'])

type RazorpayOrderResponse = {
    id: string
    amount: number
    currency: string
    receipt: string
}

function isRazorpayConfigured() {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

async function createRazorpayOrder(params: {
    amountInPaise: number
    receipt: string
    notes: Record<string, string>
}) {
    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
        throw new Error('Razorpay keys are not configured')
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            amount: params.amountInPaise,
            currency: 'INR',
            receipt: params.receipt,
            notes: params.notes
        })
    })

    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.id) {
        throw new Error(data?.error?.description || 'Unable to create Razorpay order')
    }

    return data as RazorpayOrderResponse
}

export async function GET(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    const conn = await getConnection()
    try {
        let rows: any[] = []

        if (user.role === 'admin') {
            const [allRows] = await conn.query<any[]>(
                `SELECT o.id, o.user_id, o.total_amount, o.status, o.payment_method, o.payment_status, o.created_at,
                        u.name AS customer_name, u.email AS customer_email,
                        COUNT(oi.id) AS item_count
                 FROM orders o
                 JOIN users u ON u.id = o.user_id
                 LEFT JOIN order_items oi ON oi.order_id = o.id
                 GROUP BY o.id
                 ORDER BY o.created_at DESC`
            )
            rows = allRows
        } else if (user.role === 'vendor') {
            const [vendorRows] = await conn.query<any[]>(
                `SELECT o.id, o.user_id, o.total_amount, o.status, o.payment_method, o.payment_status, o.created_at,
                        u.name AS customer_name, u.email AS customer_email,
                        SUM(CASE WHEN oi.vendor_id = ? THEN oi.line_total ELSE 0 END) AS vendor_order_value,
                        SUM(CASE WHEN oi.vendor_id = ? THEN oi.platform_commission ELSE 0 END) AS commission,
                        SUM(CASE WHEN oi.vendor_id = ? THEN oi.vendor_payout ELSE 0 END) AS payout
                 FROM orders o
                 JOIN users u ON u.id = o.user_id
                 JOIN order_items oi ON oi.order_id = o.id
                 WHERE oi.vendor_id = ?
                 GROUP BY o.id
                 ORDER BY o.created_at DESC`,
                [user.id, user.id, user.id, user.id]
            )
            rows = vendorRows
        } else {
            const [customerRows] = await conn.query<any[]>(
                `SELECT id, user_id, total_amount, status, payment_method, payment_status, created_at
                 FROM orders
                 WHERE user_id = ?
                 ORDER BY created_at DESC`,
                [user.id]
            )
            rows = customerRows
        }

        return NextResponse.json({ orders: rows })
    } catch (err) {
        console.error('Failed to fetch orders', err)
        return NextResponse.json({ error: 'Unable to fetch orders' }, { status: 500 })
    } finally {
        conn.release()
    }
}

export async function POST(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    const body = await req.json()
    const items: OrderItemInput[] = Array.isArray(body?.items) ? body.items : []
    const paymentMethod = String(body?.payment_method || 'cod').toLowerCase()
    const couponDiscount = Math.max(0, Number(body?.coupon_discount || 0))
    const orderNotes = body?.order_notes ? String(body.order_notes).trim() : null
    const contactNumber = body?.contact_number ? String(body.contact_number).trim() : null

    if (!PAYMENT_METHODS.has(paymentMethod)) {
        return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }

    if (!items.length) {
        return NextResponse.json({ error: 'No order items provided' }, { status: 400 })
    }

    const normalizedItems = items
        .map((item) => ({
            product_id: Number(item.product_id),
            variant_id:
                item.variant_id === null || item.variant_id === undefined ? null : Number(item.variant_id),
            quantity: Number(item.quantity)
        }))
        .filter((item) => !Number.isNaN(item.product_id) && !Number.isNaN(item.quantity) && item.quantity > 0)

    if (!normalizedItems.length) {
        return NextResponse.json({ error: 'Invalid items payload' }, { status: 400 })
    }

    const productIds = [...new Set(normalizedItems.map((item) => item.product_id))]
    const variantIds = [...new Set(normalizedItems.map((item) => item.variant_id).filter((id) => id !== null))] as number[]

    const isOnlinePayment = paymentMethod !== 'cod'
    if (isOnlinePayment && !isRazorpayConfigured()) {
        return NextResponse.json(
            { error: 'Razorpay is not configured for online payments. Use COD or set Razorpay keys.' },
            { status: 400 }
        )
    }

    const paymentProvider = isOnlinePayment ? 'razorpay' : 'mock'
    const paymentStatus = paymentProvider === 'razorpay' || paymentMethod === 'cod' ? 'pending' : 'paid'
    const paymentReference = paymentProvider === 'mock' ? `MOCKPAY-${Date.now().toString(36).toUpperCase()}` : null

    const conn = await getConnection()

    try {
        await conn.beginTransaction()

        let addressId: number | null = null
        if (body?.address_id) {
            const [addressRows] = await conn.query<any[]>(
                'SELECT id FROM addresses WHERE id = ? AND user_id = ? LIMIT 1',
                [Number(body.address_id), user.id]
            )
            if (!addressRows.length) {
                await conn.rollback()
                return NextResponse.json({ error: 'Address not found' }, { status: 400 })
            }
            addressId = Number(addressRows[0].id)
        } else if (body?.address) {
            const address = body.address
            const [addressInsert] = await conn.execute<ResultSetHeader>(
                `INSERT INTO addresses (user_id, label, full_name, phone, line1, line2, city, state, pincode, country, is_default)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    user.id,
                    String(address?.label || 'Home').trim(),
                    String(address?.full_name || user.name).trim(),
                    String(address?.phone || contactNumber || '').trim(),
                    String(address?.line1 || '').trim(),
                    String(address?.line2 || '').trim() || null,
                    String(address?.city || '').trim(),
                    String(address?.state || '').trim(),
                    String(address?.pincode || '').trim(),
                    String(address?.country || 'India').trim(),
                    Number(address?.is_default ? 1 : 0)
                ]
            )
            addressId = Number(addressInsert.insertId)
        }

        const [productRows] = await conn.query<ProductRow[]>(
            `SELECT p.id, p.vendor_id, p.name, p.price, p.discount_percent, p.stock,
                    COALESCE(u.commission_rate, ?) AS commission_rate
             FROM products p
             JOIN users u ON u.id = p.vendor_id
                         WHERE p.id IN (${productIds.map(() => '?').join(',')})
                             AND p.is_active = 1
             FOR UPDATE`,
            [getCommissionRatePercent(), ...productIds]
        )

        const productById = new Map<number, ProductRow>()
        for (const product of productRows) {
            productById.set(Number(product.id), product)
        }

        let variantById = new Map<number, VariantRow>()
        if (variantIds.length) {
            const [variantRows] = await conn.query<VariantRow[]>(
                `SELECT id, product_id, color, size, additional_price, stock
                 FROM product_variants
                 WHERE id IN (${variantIds.map(() => '?').join(',')})
                 FOR UPDATE`,
                variantIds
            )

            variantById = new Map<number, VariantRow>()
            for (const variant of variantRows) {
                variantById.set(Number(variant.id), variant)
            }
        }

        let subtotal = 0
        const orderItemRows: Array<{
            product: ProductRow
            variant: VariantRow | null
            quantity: number
            unitPriceWithVariant: number
            lineSubtotal: number
            lineTotal: number
            platformCommission: number
            vendorPayout: number
        }> = []

        for (const item of normalizedItems) {
            const product = productById.get(item.product_id)
            if (!product) throw new Error(`Product ${item.product_id} not found`)

            const variant = item.variant_id ? variantById.get(item.variant_id) || null : null
            if (item.variant_id && !variant) throw new Error(`Variant ${item.variant_id} not found`)
            if (variant && Number(variant.product_id) !== Number(product.id)) throw new Error('Variant does not match product')

            const quantity = Number(item.quantity)
            if (product.stock < quantity) throw new Error(`Product ${product.name} is out of stock`)
            if (variant && variant.stock < quantity) throw new Error(`Variant for ${product.name} is out of stock`)

            const unitPriceWithVariant = Number(product.price) + Number(variant?.additional_price || 0)
            const lineSubtotal = unitPriceWithVariant * quantity
            const lineTotal = lineSubtotal - (lineSubtotal * Number(product.discount_percent || 0)) / 100
            const commissionRate = Number(product.commission_rate || getCommissionRatePercent())
            const platformCommission = (lineTotal * commissionRate) / 100
            const vendorPayout = lineTotal - platformCommission

            subtotal += lineTotal

            orderItemRows.push({
                product,
                variant,
                quantity,
                unitPriceWithVariant,
                lineSubtotal,
                lineTotal,
                platformCommission,
                vendorPayout
            })
        }

        const deliveryCharge = getDeliveryCharge(subtotal)
        const total = subtotal + deliveryCharge - couponDiscount
        let razorpayOrder: RazorpayOrderResponse | null = null

        const [orderInsert] = await conn.execute<ResultSetHeader>(
            `INSERT INTO orders (
              user_id,
              address_id,
              subtotal,
              delivery_charge,
              discount_amount,
              total_amount,
              status,
              payment_method,
              payment_provider,
              payment_status,
              payment_reference,
              tracking_number,
              contact_number,
              order_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user.id,
                addressId,
                Number(subtotal.toFixed(2)),
                Number(deliveryCharge.toFixed(2)),
                Number(couponDiscount.toFixed(2)),
                Number(total.toFixed(2)),
                'placed',
                paymentMethod,
                paymentProvider,
                paymentStatus,
                paymentReference,
                makeTrackingNumber('ORD'),
                contactNumber,
                orderNotes
            ]
        )

        const orderId = Number(orderInsert.insertId)
        const transactionReferenceBase = paymentReference || `ORDER-${orderId}`

        for (const row of orderItemRows) {
            const itemTrackingNumber = makeTrackingNumber('ITM')

            const [itemInsert] = await conn.execute<ResultSetHeader>(
                `INSERT INTO order_items (
                  order_id,
                  product_id,
                  variant_id,
                  vendor_id,
                  product_name,
                  color,
                  size,
                  quantity,
                  price_each,
                  discount_percent,
                  line_subtotal,
                  platform_commission,
                  vendor_payout,
                  line_total,
                  status,
                  mock_tracking_number
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderId,
                    row.product.id,
                    row.variant?.id || null,
                    row.product.vendor_id,
                    row.product.name,
                    row.variant?.color || null,
                    row.variant?.size || null,
                    row.quantity,
                    Number(row.unitPriceWithVariant.toFixed(2)),
                    Number(row.product.discount_percent || 0),
                    Number(row.lineSubtotal.toFixed(2)),
                    Number(row.platformCommission.toFixed(2)),
                    Number(row.vendorPayout.toFixed(2)),
                    Number(row.lineTotal.toFixed(2)),
                    'placed',
                    itemTrackingNumber
                ]
            )

            const orderItemId = Number(itemInsert.insertId)

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
                    orderItemId,
                    user.id,
                    row.product.vendor_id,
                    'payment',
                    Number(row.lineTotal.toFixed(2)),
                    0,
                    0,
                    0,
                    paymentMethod,
                    transactionReferenceBase,
                    paymentStatus === 'paid' ? 'success' : 'pending'
                ]
            )

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
                    orderItemId,
                    user.id,
                    row.product.vendor_id,
                    'commission',
                    Number(row.lineTotal.toFixed(2)),
                    Number(row.platformCommission.toFixed(2)),
                    0,
                    0,
                    paymentMethod,
                    `${transactionReferenceBase}-COMM`,
                    paymentStatus === 'paid' ? 'success' : 'pending'
                ]
            )

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
                    orderItemId,
                    user.id,
                    row.product.vendor_id,
                    'vendor_payout',
                    Number(row.lineTotal.toFixed(2)),
                    Number(row.platformCommission.toFixed(2)),
                    Number(row.vendorPayout.toFixed(2)),
                    0,
                    paymentMethod,
                    `${transactionReferenceBase}-PAYOUT`,
                    paymentStatus === 'paid' ? 'success' : 'pending'
                ]
            )

            await conn.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [row.quantity, row.product.id])

            if (row.variant) {
                await conn.execute('UPDATE product_variants SET stock = stock - ? WHERE id = ?', [row.quantity, row.variant.id])
            }
        }

        if (paymentProvider === 'razorpay') {
            razorpayOrder = await createRazorpayOrder({
                amountInPaise: Math.round(Number(total.toFixed(2)) * 100),
                receipt: `stella-order-${orderId}-${Date.now()}`.slice(0, 40),
                notes: {
                    internal_order_id: String(orderId),
                    customer_id: String(user.id)
                }
            })

            await conn.execute(
                'UPDATE orders SET razorpay_order_id = ?, payment_reference = ? WHERE id = ?',
                [razorpayOrder.id, razorpayOrder.id, orderId]
            )

            await conn.execute(
                `UPDATE transactions
                 SET reference = CASE
                   WHEN transaction_type = 'payment' THEN ?
                   WHEN transaction_type = 'commission' THEN ?
                   WHEN transaction_type = 'vendor_payout' THEN ?
                   ELSE reference
                 END
                 WHERE order_id = ?`,
                [
                    razorpayOrder.id,
                    `${razorpayOrder.id}-COMM`,
                    `${razorpayOrder.id}-PAYOUT`,
                    orderId
                ]
            )
        }

        await conn.execute('DELETE FROM cart_items WHERE user_id = ?', [user.id])

        await conn.commit()
        return NextResponse.json({
            order_id: orderId,
            total_amount: Number(total.toFixed(2)),
            subtotal: Number(subtotal.toFixed(2)),
            delivery_charge: Number(deliveryCharge.toFixed(2)),
            discount_amount: Number(couponDiscount.toFixed(2)),
            payment_method: paymentMethod,
            payment_provider: paymentProvider,
            payment_status: paymentStatus,
            payment_reference: razorpayOrder?.id || paymentReference,
            requires_payment: paymentProvider === 'razorpay',
            razorpay:
                paymentProvider === 'razorpay' && razorpayOrder
                    ? {
                        key_id: process.env.RAZORPAY_KEY_ID,
                        order_id: razorpayOrder.id,
                        amount: razorpayOrder.amount,
                        currency: razorpayOrder.currency,
                        name: 'Stella Marketplace',
                        description: `Order #${orderId}`
                    }
                    : null,
            can_cancel: true,
            created_at: new Date().toISOString()
        })
    } catch (err: any) {
        await conn.rollback()
        console.error('Failed to create order', err)
        return NextResponse.json({ error: err?.message || 'Unable to create order' }, { status: 500 })
    } finally {
        conn.release()
    }
}
