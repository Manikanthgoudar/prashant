import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { signUserToken, verifyPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    const body = await req.json()
    const email = body?.email?.trim()?.toLowerCase()
    const password = body?.password

    if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })

    try {
        const users = await query<any>(
            `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.is_active, v.store_name
             FROM users u
             LEFT JOIN vendors v ON v.user_id = u.id
             WHERE u.email = ?
             LIMIT 1`,
            [email]
        )
        const user = users[0]
        if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        if (Number(user.is_active) !== 1) return NextResponse.json({ error: 'Account is inactive' }, { status: 403 })

        const ok = await verifyPassword(password, user.password_hash)
        if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

        const token = await signUserToken({ id: user.id, email: user.email, name: user.name, role: user.role })
        return NextResponse.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                store_name: user.store_name || null
            }
        })
    } catch (err) {
        console.error('Login failed', err)
        return NextResponse.json({ error: 'Unable to login' }, { status: 500 })
    }
}
