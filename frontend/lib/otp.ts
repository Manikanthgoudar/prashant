import crypto from 'crypto'

export type OtpPurpose = 'signup' | 'login'

const OTP_PURPOSE_SET = new Set<OtpPurpose>(['signup', 'login'])

function toPositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number(value)
    if (Number.isNaN(parsed) || parsed <= 0) return fallback
    return Math.floor(parsed)
}

export function normalizeOtpPurpose(value: string | undefined): OtpPurpose | null {
    if (!value) return null
    const normalized = value.trim().toLowerCase() as OtpPurpose
    return OTP_PURPOSE_SET.has(normalized) ? normalized : null
}

export function otpLength(): number {
    const parsed = toPositiveInt(process.env.OTP_LENGTH, 6)
    return Math.min(8, Math.max(4, parsed))
}

export function otpExpiryMinutes(): number {
    const parsed = toPositiveInt(process.env.OTP_EXPIRY_MINUTES, 10)
    return Math.min(30, Math.max(2, parsed))
}

export function otpRateLimitSeconds(): number {
    const parsed = toPositiveInt(process.env.OTP_RATE_LIMIT_SECONDS, 60)
    return Math.min(600, Math.max(15, parsed))
}

export function otpMaxAttempts(): number {
    const parsed = toPositiveInt(process.env.OTP_MAX_ATTEMPTS, 5)
    return Math.min(10, Math.max(3, parsed))
}

export function generateNumericOtp(length = otpLength()): string {
    let value = ''
    for (let idx = 0; idx < length; idx += 1) {
        value += String(crypto.randomInt(0, 10))
    }
    return value
}

export function hashOtpValue(email: string, purpose: OtpPurpose, otp: string): string {
    const normalizedEmail = email.trim().toLowerCase()
    const pepper = process.env.OTP_PEPPER || process.env.JWT_SECRET || 'dev-otp-pepper'
    return crypto
        .createHash('sha256')
        .update(`${pepper}:${normalizedEmail}:${purpose}:${otp}`)
        .digest('hex')
}

export function createOtpExpiryDate(minutes = otpExpiryMinutes()): Date {
    return new Date(Date.now() + minutes * 60_000)
}
