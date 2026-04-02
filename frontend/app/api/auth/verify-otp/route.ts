import { NextRequest, NextResponse } from 'next/server'
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { execute, getConnection, query } from '@/lib/db'
import { hashPassword, signUserToken } from '@/lib/auth'
import { hashOtpValue, normalizeOtpPurpose, otpMaxAttempts } from '@/lib/otp'

export const dynamic = 'force-dynamic'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type OtpRow = RowDataPacket & {
    id: number
    otp_hash: string
    attempts: number
    expires_at: Date
}

type UserRow = RowDataPacket & {
    id: number
    name: string
    email: string
    role: 'admin' | 'vendor' | 'customer'
    is_active: number
    store_name: string | null
}

function normalizeRole(value: string | undefined): 'admin' | 'vendor' | 'customer' {
    const role = String(value || 'customer').toLowerCase()
    if (role === 'admin' || role === 'vendor') return role
    return 'customer'
}

async function fetchUserByEmail(email: string): Promise<UserRow | null> {
    const users = await query<UserRow>(
        `SELECT u.id, u.name, u.email, u.role, u.is_active, v.store_name
         FROM users u
         LEFT JOIN vendors v ON v.user_id = u.id
         WHERE u.email = ?
         LIMIT 1`,
        [email]
    )

    return users[0] || null
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}))
    const email = String(body?.email || '').trim().toLowerCase()
    const otp = String(body?.otp || '').trim()
    const purpose = normalizeOtpPurpose(String(body?.purpose || ''))

    if (!EMAIL_REGEX.test(email)) {
        return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    if (!purpose) {
        return NextResponse.json({ error: 'Valid OTP purpose is required' }, { status: 400 })
    }

    if (!/^\d{4,8}$/.test(otp)) {
        return NextResponse.json({ error: 'Valid OTP is required' }, { status: 400 })
    }

    try {
        const otpRows = await query<OtpRow>(
            `SELECT id, otp_hash, attempts, expires_at
             FROM email_otps
             WHERE email = ?
               AND purpose = ?
               AND consumed_at IS NULL
             ORDER BY created_at DESC
             LIMIT 1`,
            [email, purpose]
        )

        const otpRecord = otpRows[0]
        if (!otpRecord) {
            return NextResponse.json({ error: 'No active OTP found. Please request a new one.' }, { status: 400 })
        }

        if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
            return NextResponse.json({ error: 'OTP expired. Please request a new one.' }, { status: 400 })
        }

        const maxAttempts = otpMaxAttempts()
        if (Number(otpRecord.attempts) >= maxAttempts) {
            return NextResponse.json({ error: 'Too many invalid OTP attempts. Request a new OTP.' }, { status: 429 })
        }

        const expectedHash = hashOtpValue(email, purpose, otp)
        if (expectedHash !== otpRecord.otp_hash) {
            await execute('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ? AND consumed_at IS NULL', [otpRecord.id])
            return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
        }

        if (purpose === 'login') {
            const user = await fetchUserByEmail(email)
            if (!user) {
                return NextResponse.json({ error: 'Account not found for this email' }, { status: 404 })
            }
            if (Number(user.is_active) !== 1) {
                return NextResponse.json({ error: 'Account is inactive' }, { status: 403 })
            }

            await execute(
                'UPDATE email_otps SET consumed_at = NOW(), attempts = attempts + 1 WHERE id = ? AND consumed_at IS NULL',
                [otpRecord.id]
            )

            const token = await signUserToken({
                id: Number(user.id),
                email: String(user.email),
                name: String(user.name),
                role: user.role
            })

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
        }

        const name = String(body?.name || '').trim()
        const password = String(body?.password || '').trim()
        const storeName = String(body?.storeName || '').trim()
        const role = normalizeRole(body?.role)

        if (!name || password.length < 6) {
            return NextResponse.json(
                { error: 'Name and password (min 6 characters) are required for signup verification' },
                { status: 400 }
            )
        }

        if (role === 'admin' && body?.adminKey !== process.env.ADMIN_SIGNUP_KEY) {
            return NextResponse.json({ error: 'Invalid admin key' }, { status: 403 })
        }

        const conn = await getConnection()
        try {
            await conn.beginTransaction()

            const [existingRows] = await conn.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
            if (existingRows.length) {
                await conn.rollback()
                return NextResponse.json({ error: 'Email already registered. Please sign in.' }, { status: 409 })
            }

            const passwordHash = await hashPassword(password)
            const [insertResult] = await conn.execute<ResultSetHeader>(
                'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                [name, email, passwordHash, role]
            )
            const userId = Number(insertResult.insertId)

            if (role === 'vendor') {
                await conn.execute(
                    'INSERT INTO vendors (user_id, store_name, description, status) VALUES (?, ?, ?, ?)',
                    [userId, storeName || `${name} Store`, 'New marketplace seller', 'active']
                )
            }

            await conn.execute(
                'UPDATE email_otps SET consumed_at = NOW(), attempts = attempts + 1 WHERE id = ? AND consumed_at IS NULL',
                [otpRecord.id]
            )

            await conn.commit()

            const user = await fetchUserByEmail(email)
            if (!user) {
                return NextResponse.json({ error: 'Unable to finalize signup' }, { status: 500 })
            }

            const token = await signUserToken({
                id: Number(user.id),
                email: String(user.email),
                name: String(user.name),
                role: user.role
            })

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
            await conn.rollback()
            throw err
        } finally {
            conn.release()
        }
    } catch (err) {
        console.error('Failed to verify OTP', err)
        return NextResponse.json({ error: 'Unable to verify OTP' }, { status: 500 })
    }
}
