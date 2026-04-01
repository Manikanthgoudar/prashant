import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { signUserToken, verifyPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type UserRow = { id: number; name: string; email: string; password_hash: string }

export async function POST(req: NextRequest) {
    const body = await req.json()
    const email = body?.email?.trim()?.toLowerCase()
    const password = body?.password

    if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })

    try {
        const users = await query<any>('SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1', [email])
        const user = users[0]
        if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

        const ok = await verifyPassword(password, user.password_hash)
        if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

        const token = await signUserToken({ id: user.id, email: user.email, name: user.name })
        return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email } })
    } catch (err) {
        console.error('Login failed', err)
        return NextResponse.json({ error: 'Unable to login' }, { status: 500 })
    }
}
