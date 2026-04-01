import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { Product } from '@/types'
import { RowDataPacket } from 'mysql2/promise'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('category_id')
    const q = searchParams.get('q')

    const clauses: string[] = []
    const params: any[] = []

    if (categoryId) {
        clauses.push('category_id = ?')
        params.push(Number(categoryId))
    }

    if (q) {
        clauses.push('(name LIKE ? OR description LIKE ?)')
        params.push(`%${q}%`, `%${q}%`)
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const sql = `SELECT id, name, description, price, image_url, stock, category_id, colors FROM products ${where} ORDER BY created_at DESC, id DESC`

    try {
        type ProductRow = Product & RowDataPacket
        const products = await query<ProductRow>(sql, params)
        return NextResponse.json(products)
    } catch (err) {
        console.error('Failed to load products', err)
        return NextResponse.json({ error: 'Unable to load products' }, { status: 500 })
    }
}
