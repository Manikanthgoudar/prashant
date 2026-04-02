import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { tokenFromAuthHeader, verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const token = tokenFromAuthHeader(req.headers)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const users = await query<any>(
            `SELECT u.id, u.name, u.email, u.role, v.store_name
             FROM users u
             LEFT JOIN vendors v ON v.user_id = u.id
             WHERE u.id = ?`,
            [payload.id]
        )
        const user = users[0]
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        return NextResponse.json({ user })
    } catch (err) {
        console.error('Failed to load current user', err)
        return NextResponse.json({ error: 'Unable to load user' }, { status: 500 })
    }
}
