import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { Category } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const categories = await query<any>('SELECT id, name, icon, parent_id FROM categories ORDER BY id')
        return NextResponse.json(categories)
    } catch (err) {
        console.error('Failed to load categories', err)
        return NextResponse.json({ error: 'Unable to load categories' }, { status: 500 })
    }
}
