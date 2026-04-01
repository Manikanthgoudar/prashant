import { NextRequest, NextResponse } from 'next/server'
import { execute, query } from '@/lib/db'
import { hashPassword, signUserToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type UserRow = { id: number; name: string; email: string; password_hash: string }

export async function POST(req: NextRequest) {
    const body = await req.json()
    const name = body?.name?.trim()
    const email = body?.email?.trim()?.toLowerCase()
    const password = body?.password

    if (!name || !email || !password) {
        return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
    }

    try {
        const existing = await query<any>('SELECT id FROM users WHERE email = ?', [email])
        if (existing.length) return NextResponse.json({ error: 'Email already registered' }, { status: 409 })

        const passwordHash = await hashPassword(password)
        const insertResult = await execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, passwordHash])
        const userId = insertResult.insertId
        const token = await signUserToken({ id: userId, email, name })

        return NextResponse.json({ token, user: { id: userId, name, email } })
    } catch (err) {
        console.error('Signup failed', err)
        return NextResponse.json({ error: 'Unable to sign up' }, { status: 500 })
    }
}
