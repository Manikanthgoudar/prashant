import { NextRequest, NextResponse } from 'next/server'
import { execute, query } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const categories = await query<any>(
                        `SELECT id, name, slug, icon, description, parent_id
                         FROM categories
                         ORDER BY
                             CASE
                                 WHEN parent_id IS NULL AND name = 'Men' THEN 0
                                 WHEN parent_id IS NULL AND name = 'Women' THEN 1
                                 WHEN parent_id IS NULL AND name = 'Kids' THEN 2
                                 WHEN parent_id IS NULL THEN 3
                                 ELSE 4
                             END,
                             COALESCE(parent_id, id),
                             name`
        )

        const byParent = new Map<number | null, any[]>()
        for (const category of categories) {
            const key = category.parent_id === null ? null : Number(category.parent_id)
            const existing = byParent.get(key) || []
            existing.push({ ...category, children: [] })
            byParent.set(key, existing)
        }

        const roots = byParent.get(null) || []
        for (const root of roots) {
            root.children = byParent.get(Number(root.id)) || []
        }

        return NextResponse.json({ categories, tree: roots })
    } catch (err) {
        console.error('Failed to load categories', err)
        return NextResponse.json({ error: 'Unable to load categories' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const { user, error } = await requireAuth(req, ['admin'])
    if (!user) return error as NextResponse

    const body = await req.json()
    const name = String(body?.name || '').trim()
    const parentId = body?.parent_id ? Number(body.parent_id) : null
    const slug = String(body?.slug || name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

    if (!name) {
        return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    try {
        await execute('INSERT INTO categories (name, slug, icon, description, parent_id) VALUES (?, ?, ?, ?, ?)', [
            name,
            slug,
            body?.icon || null,
            body?.description || null,
            parentId
        ])
        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error('Failed to create category', err)
        return NextResponse.json({ error: 'Unable to create category' }, { status: 500 })
    }
}
