import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { RowDataPacket } from 'mysql2/promise'
import { Product } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    const categoryId = Number(id)
    if (Number.isNaN(categoryId)) {
        return NextResponse.json({ error: 'Invalid category id' }, { status: 400 })
    }

    try {
        type ProductRow = Product & RowDataPacket
        const products = await query<ProductRow>(
            'SELECT id, name, description, price, image_url, stock, category_id, colors FROM products WHERE category_id = ? ORDER BY name',
            [categoryId]
        )
        return NextResponse.json(products)
    } catch (err) {
        console.error('Failed to load category products', err)
        return NextResponse.json({ error: 'Unable to load category products' }, { status: 500 })
    }
}
