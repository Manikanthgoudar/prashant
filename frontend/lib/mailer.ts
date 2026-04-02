import nodemailer from 'nodemailer'
import { OtpPurpose } from '@/lib/otp'

let cachedTransporter: nodemailer.Transporter | null = null

function smtpConfig() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com'
    const port = Number(process.env.SMTP_PORT || 465)
    const secure = String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true'
    const user = process.env.SMTP_USER || ''
    const pass = process.env.SMTP_PASS || ''

    if (!user || !pass) {
        throw new Error('SMTP credentials missing. Set SMTP_USER and SMTP_PASS in .env')
    }

    return { host, port, secure, user, pass }
}

function getTransporter() {
    if (cachedTransporter) return cachedTransporter

    const config = smtpConfig()
    cachedTransporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass
        }
    })

    return cachedTransporter
}

function otpMailCopy(purpose: OtpPurpose, otp: string, expiresInMinutes: number) {
    const heading = purpose === 'signup' ? 'Complete Your Stella Signup' : 'Your Stella Login OTP'
    const intro =
        purpose === 'signup'
            ? 'Use this one-time passcode to verify your email and finish creating your account.'
            : 'Use this one-time passcode to log in to your Stella account.'

    const text = `${heading}\n\n${intro}\nOTP: ${otp}\nExpires in: ${expiresInMinutes} minutes\n\nDo not share this OTP with anyone.`

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; line-height: 1.5; color: #1f2937;">
        <h2 style="margin-bottom: 12px; color: #0f172a;">${heading}</h2>
        <p style="margin-bottom: 12px;">${intro}</p>
        <div style="font-size: 28px; letter-spacing: 8px; font-weight: 700; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; display: inline-block; margin-bottom: 12px;">${otp}</div>
        <p style="margin-bottom: 6px;">Expires in <strong>${expiresInMinutes} minutes</strong>.</p>
        <p style="margin-bottom: 0; color: #b91c1c;"><strong>Do not share this OTP with anyone.</strong></p>
      </div>
    `

    return { heading, text, html }
}

export async function sendOtpEmail(payload: {
    email: string
    otp: string
    purpose: OtpPurpose
    expiresInMinutes: number
}) {
    const transporter = getTransporter()
    const { user } = smtpConfig()
    const from = process.env.SMTP_FROM || `Stella Marketplace <${user}>`
    const copy = otpMailCopy(payload.purpose, payload.otp, payload.expiresInMinutes)

    await transporter.sendMail({
        from,
        to: payload.email,
        subject: copy.heading,
        text: copy.text,
        html: copy.html
    })
}
