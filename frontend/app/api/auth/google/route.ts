import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { OAuth2Client } from 'google-auth-library'
import { getConnection, query } from '@/lib/db'
import { hashPassword, signUserToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function normalizedEnvValue(value: string | undefined): string {
    return String(value || '')
        .trim()
        .replace(/^['"]|['"]$/g, '')
}

function isGoogleClientId(value: string): boolean {
    return value.endsWith('.apps.googleusercontent.com')
}

function resolveGoogleClientId(): string {
    const serverClientId = normalizedEnvValue(process.env.GOOGLE_CLIENT_ID)
    const publicClientId = normalizedEnvValue(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)

    if (isGoogleClientId(serverClientId)) return serverClientId
    if (isGoogleClientId(publicClientId)) return publicClientId
    return ''
}

function resolveMaxIdTokenExpirySeconds(): number {
    const parsed = Number(process.env.GOOGLE_ID_TOKEN_MAX_EXPIRY_SECONDS || 172800)
    if (Number.isNaN(parsed)) return 172800
    return Math.min(604800, Math.max(3600, Math.floor(parsed)))
}

const googleClientId = resolveGoogleClientId()
const maxIdTokenExpirySeconds = resolveMaxIdTokenExpirySeconds()
const oauthClient = googleClientId ? new OAuth2Client(googleClientId) : null

type UserRow = RowDataPacket & {
    id: number
    name: string
    email: string
    role: 'admin' | 'vendor' | 'customer'
    is_active: number
    store_name: string | null
}

async function fetchUserByEmail(email: string): Promise<UserRow | null> {
    const rows = await query<UserRow>(
        `SELECT u.id, u.name, u.email, u.role, u.is_active, v.store_name
         FROM users u
         LEFT JOIN vendors v ON v.user_id = u.id
         WHERE u.email = ?
         LIMIT 1`,
        [email]
    )

    return rows[0] || null
}

export async function POST(req: NextRequest) {
    if (!oauthClient || !googleClientId) {
        return NextResponse.json(
            { error: 'Google auth is not configured. Set GOOGLE_CLIENT_ID (Web Client ID) in .env' },
            { status: 500 }
        )
    }

    const body = await req.json().catch(() => ({}))
    const idToken = String(body?.idToken || body?.credential || '').trim()

    if (!idToken) {
        return NextResponse.json({ error: 'Google credential is required' }, { status: 400 })
    }

    try {
        const ticket = await oauthClient.verifyIdToken({
            idToken,
            audience: googleClientId,
            maxExpiry: maxIdTokenExpirySeconds
        })

        const payload = ticket.getPayload()
        const email = String(payload?.email || '').trim().toLowerCase()
        const name = String(payload?.name || '').trim() || 'Google User'
        const emailVerified = Boolean(payload?.email_verified)

        if (!email || !emailVerified) {
            return NextResponse.json({ error: 'Google account email is not verified' }, { status: 400 })
        }

        let user = await fetchUserByEmail(email)

        if (!user) {
            const conn = await getConnection()
            try {
                await conn.beginTransaction()

                const randomPassword = crypto.randomBytes(24).toString('hex')
                const passwordHash = await hashPassword(randomPassword)

                await conn.execute<ResultSetHeader>(
                    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                    [name, email, passwordHash, 'customer']
                )

                await conn.commit()
            } catch (err) {
                await conn.rollback()
                throw err
            } finally {
                conn.release()
            }

            user = await fetchUserByEmail(email)
        }

        if (!user) {
            return NextResponse.json({ error: 'Unable to complete Google sign-in' }, { status: 500 })
        }

        if (Number(user.is_active) !== 1) {
            return NextResponse.json({ error: 'Account is inactive' }, { status: 403 })
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
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('Google auth failed', err)

        if (message.toLowerCase().includes('expiration time too far in future')) {
            return NextResponse.json(
                {
                    error:
                        'Google token rejected due clock skew. Please retry; if issue persists, sync system time or increase GOOGLE_ID_TOKEN_MAX_EXPIRY_SECONDS.'
                },
                { status: 401 }
            )
        }

        return NextResponse.json({ error: 'Unable to sign in with Google' }, { status: 401 })
    }
}
