import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret')

export type UserRole = 'admin' | 'vendor' | 'customer'

export interface JwtUser {
    id: number
    email: string
    name: string
    role: UserRole
}

export async function hashPassword(password: string) {
    return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash)
}

export async function signUserToken(user: JwtUser) {
    return new SignJWT({ id: user.id, email: user.email, name: user.name, role: user.role })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret)
}

export async function verifyToken(token: string): Promise<JwtUser | null> {
    try {
        const { payload } = await jwtVerify(token, secret)
        const role = String(payload.role || 'customer') as UserRole
        return { id: Number(payload.id), email: String(payload.email), name: String(payload.name), role }
    } catch (err) {
        console.error('Token verification failed', err)
        return null
    }
}

export function tokenFromAuthHeader(headers: Headers): string | null {
    const auth = headers.get('authorization') || ''
    if (!auth.toLowerCase().startsWith('bearer ')) return null
    return auth.slice(7)
}
