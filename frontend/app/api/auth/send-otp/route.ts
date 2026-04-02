import { NextRequest, NextResponse } from 'next/server'
import { RowDataPacket } from 'mysql2/promise'
import { execute, query } from '@/lib/db'
import {
    createOtpExpiryDate,
    generateNumericOtp,
    hashOtpValue,
    normalizeOtpPurpose,
    otpExpiryMinutes,
    otpRateLimitSeconds
} from '@/lib/otp'
import { sendOtpEmail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type UserLookupRow = RowDataPacket & {
    id: number
    is_active?: number
}

type LastOtpRow = RowDataPacket & {
    created_at: Date
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}))
    const rawEmail = String(body?.email || '')
    const email = rawEmail.trim().toLowerCase()
    const purpose = normalizeOtpPurpose(String(body?.purpose || ''))

    if (!EMAIL_REGEX.test(email)) {
        return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    if (!purpose) {
        return NextResponse.json({ error: 'Valid OTP purpose is required' }, { status: 400 })
    }

    try {
        if (purpose === 'signup') {
            const existing = await query<UserLookupRow>('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
            if (existing.length) {
                return NextResponse.json({ error: 'Email already registered. Please sign in.' }, { status: 409 })
            }
        } else {
            const users = await query<UserLookupRow>('SELECT id, is_active FROM users WHERE email = ? LIMIT 1', [email])
            if (!users.length) {
                return NextResponse.json({ error: 'Account not found for this email' }, { status: 404 })
            }
            if (Number(users[0].is_active) !== 1) {
                return NextResponse.json({ error: 'Account is inactive' }, { status: 403 })
            }
        }

        const waitSeconds = otpRateLimitSeconds()
        const recentRows = await query<LastOtpRow>(
            `SELECT created_at
             FROM email_otps
             WHERE email = ? AND purpose = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [email, purpose]
        )

        if (recentRows.length) {
            const createdAt = new Date(recentRows[0].created_at).getTime()
            const diffSeconds = Math.floor((Date.now() - createdAt) / 1000)
            if (diffSeconds < waitSeconds) {
                return NextResponse.json(
                    {
                        error: `Please wait ${waitSeconds - diffSeconds}s before requesting another OTP`,
                        retry_after_seconds: waitSeconds - diffSeconds
                    },
                    { status: 429 }
                )
            }
        }

        const otp = generateNumericOtp()
        const otpHash = hashOtpValue(email, purpose, otp)
        const expiresInMinutes = otpExpiryMinutes()
        const expiresAt = createOtpExpiryDate(expiresInMinutes)

        await execute(
            `INSERT INTO email_otps (email, purpose, otp_hash, expires_at)
             VALUES (?, ?, ?, ?)`,
            [email, purpose, otpHash, expiresAt]
        )

        await sendOtpEmail({
            email,
            otp,
            purpose,
            expiresInMinutes
        })

        return NextResponse.json({
            ok: true,
            message: 'OTP sent successfully',
            expires_in_minutes: expiresInMinutes
        })
    } catch (err) {
        console.error('Failed to send OTP', err)
        return NextResponse.json({ error: 'Unable to send OTP right now' }, { status: 500 })
    }
}
