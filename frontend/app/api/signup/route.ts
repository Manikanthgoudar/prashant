import { NextRequest, NextResponse } from 'next/server'
import { getConnection, query } from '@/lib/db'
import { hashPassword, signUserToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type SignupRole = 'customer' | 'vendor' | 'admin'

export async function POST(req: NextRequest) {
    const body = await req.json()
    const name = body?.name?.trim()
    const email = body?.email?.trim()?.toLowerCase()
    const password = body?.password
    const incomingRole = String(body?.role || 'customer').toLowerCase()
    const storeName = body?.storeName?.trim()
    const role = (incomingRole === 'vendor' || incomingRole === 'admin' ? incomingRole : 'customer') as SignupRole

    if (!name || !email || !password) {
        return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
    }

    if (role === 'admin' && body?.adminKey !== process.env.ADMIN_SIGNUP_KEY) {
        return NextResponse.json({ error: 'Invalid admin key' }, { status: 403 })
    }

    try {
        const existing = await query<any>('SELECT id FROM users WHERE email = ?', [email])
        if (existing.length) return NextResponse.json({ error: 'Email already registered' }, { status: 409 })

        const passwordHash = await hashPassword(password)
        const conn = await getConnection()
        let userId = 0
        try {
            await conn.beginTransaction()
            const [insertResult] = await conn.execute<any>('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [
                name,
                email,
                passwordHash,
                role
            ])
            userId = Number(insertResult.insertId)

            if (role === 'vendor') {
                await conn.execute(
                    'INSERT INTO vendors (user_id, store_name, description, status) VALUES (?, ?, ?, ?)',
                    [userId, storeName || `${name} Store`, 'New marketplace seller', 'active']
                )
            }

            await conn.commit()
        } catch (error) {
            await conn.rollback()
            throw error
        } finally {
            conn.release()
        }

        const token = await signUserToken({ id: userId, email, name, role })

        return NextResponse.json({
            token,
            user: { id: userId, name, email, role, store_name: role === 'vendor' ? storeName || `${name} Store` : null }
        })
    } catch (err) {
        console.error('Signup failed', err)
        return NextResponse.json({ error: 'Unable to sign up' }, { status: 500 })
    }
}
