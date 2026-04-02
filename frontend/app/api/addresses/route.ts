import { NextRequest, NextResponse } from 'next/server'
import { getConnection, query } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    try {
        const addresses = await query<any>(
            `SELECT id, label, full_name, phone, line1, line2, city, state, pincode, country, is_default, created_at
       FROM addresses
       WHERE user_id = ?
       ORDER BY is_default DESC, created_at DESC`,
            [user.id]
        )
        return NextResponse.json({ addresses })
    } catch (err) {
        console.error('Failed to fetch addresses', err)
        return NextResponse.json({ error: 'Unable to fetch addresses' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    const body = await req.json()
    const payload = {
        label: String(body?.label || 'Home').trim(),
        full_name: String(body?.full_name || '').trim(),
        phone: String(body?.phone || '').trim(),
        line1: String(body?.line1 || '').trim(),
        line2: String(body?.line2 || '').trim(),
        city: String(body?.city || '').trim(),
        state: String(body?.state || '').trim(),
        pincode: String(body?.pincode || '').trim(),
        country: String(body?.country || 'India').trim(),
        is_default: Boolean(body?.is_default)
    }

    if (!payload.full_name || !payload.phone || !payload.line1 || !payload.city || !payload.state || !payload.pincode) {
        return NextResponse.json({ error: 'Missing required address fields' }, { status: 400 })
    }

    const conn = await getConnection()
    try {
        await conn.beginTransaction()

        if (payload.is_default) {
            await conn.execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [user.id])
        }

        await conn.execute(
            `INSERT INTO addresses (user_id, label, full_name, phone, line1, line2, city, state, pincode, country, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user.id,
                payload.label,
                payload.full_name,
                payload.phone,
                payload.line1,
                payload.line2 || null,
                payload.city,
                payload.state,
                payload.pincode,
                payload.country,
                payload.is_default ? 1 : 0
            ]
        )

        await conn.commit()
        const addresses = await query<any>(
            `SELECT id, label, full_name, phone, line1, line2, city, state, pincode, country, is_default, created_at
       FROM addresses
       WHERE user_id = ?
       ORDER BY is_default DESC, created_at DESC`,
            [user.id]
        )

        return NextResponse.json({ ok: true, addresses })
    } catch (err) {
        await conn.rollback()
        console.error('Failed to save address', err)
        return NextResponse.json({ error: 'Unable to save address' }, { status: 500 })
    } finally {
        conn.release()
    }
}

export async function PATCH(req: NextRequest) {
    const { user, error } = await requireAuth(req)
    if (!user) return error as NextResponse

    const body = await req.json()
    const addressId = Number(body?.address_id)
    if (Number.isNaN(addressId)) {
        return NextResponse.json({ error: 'address_id is required' }, { status: 400 })
    }

    try {
        await query<any>('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [user.id])
        await query<any>('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [addressId, user.id])

        const addresses = await query<any>(
            `SELECT id, label, full_name, phone, line1, line2, city, state, pincode, country, is_default, created_at
       FROM addresses
       WHERE user_id = ?
       ORDER BY is_default DESC, created_at DESC`,
            [user.id]
        )

        return NextResponse.json({ ok: true, addresses })
    } catch (err) {
        console.error('Failed to update default address', err)
        return NextResponse.json({ error: 'Unable to update address' }, { status: 500 })
    }
}
