import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { tokenFromAuthHeader, verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type UserRow = { id: number; name: string; email: string }

export async function GET(req: NextRequest) {
    const token = tokenFromAuthHeader(req.headers)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const users = await query<any>('SELECT id, name, email FROM users WHERE id = ?', [payload.id])
        const user = users[0]
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        return NextResponse.json({ user })
    } catch (err) {
        console.error('Failed to load current user', err)
        return NextResponse.json({ error: 'Unable to load user' }, { status: 500 })
    }
}
