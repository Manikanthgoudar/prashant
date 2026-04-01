import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { ProductWithCategory } from '@/types'
import { RowDataPacket } from 'mysql2/promise'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id: idParam } = await context.params
    const id = Number(idParam)
    if (Number.isNaN(id)) {
        return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
    }

    try {
        type ProductRow = ProductWithCategory & RowDataPacket
        const rows = await query<ProductRow>(
            `SELECT p.id, p.name, p.description, p.price, p.image_url, p.stock, p.category_id, p.colors,
              c.id as category_id_dup, c.name as category_name, c.icon as category_icon, c.parent_id as category_parent
       FROM products p
       JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?
       LIMIT 1`,
            [id]
        )

        const product = rows[0]
        if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

        return NextResponse.json({
            ...product,
            category: {
                id: product.category_id,
                name: (product as any).category_name,
                icon: (product as any).category_icon,
                parent_id: (product as any).category_parent
            }
        })
    } catch (err) {
        console.error('Failed to load product', err)
        return NextResponse.json({ error: 'Unable to load product' }, { status: 500 })
    }
}
