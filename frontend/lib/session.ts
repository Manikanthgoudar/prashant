import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { JwtUser, tokenFromAuthHeader, UserRole, verifyToken } from '@/lib/auth'

export interface SessionUser extends JwtUser {
    store_name?: string | null
    is_active?: number
}

export async function getAuthUser(req: NextRequest): Promise<SessionUser | null> {
    const token = tokenFromAuthHeader(req.headers)
    if (!token) return null

    const payload = await verifyToken(token)
    if (!payload) return null

    const users = await query<any>(
        `SELECT u.id, u.name, u.email, u.role, u.is_active, v.store_name
         FROM users u
         LEFT JOIN vendors v ON v.user_id = u.id
         WHERE u.id = ?
         LIMIT 1`,
        [payload.id]
    )

    const user = users[0]
    if (!user || Number(user.is_active) !== 1) return null

    return {
        id: Number(user.id),
        name: String(user.name),
        email: String(user.email),
        role: String(user.role) as UserRole,
        store_name: user.store_name || null,
        is_active: Number(user.is_active)
    }
}

export async function requireAuth(
    req: NextRequest,
    allowedRoles?: UserRole[]
): Promise<{ user: SessionUser | null; error: NextResponse | null }> {
    const user = await getAuthUser(req)
    if (!user) {
        return {
            user: null,
            error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return {
            user: null,
            error: NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
    }

    return { user, error: null }
}
