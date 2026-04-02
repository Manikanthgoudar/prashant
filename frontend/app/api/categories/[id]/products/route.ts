import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { RowDataPacket } from 'mysql2/promise'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    const categoryId = Number(id)
    if (Number.isNaN(categoryId)) {
        return NextResponse.json({ error: 'Invalid category id' }, { status: 400 })
    }

    try {
        type ProductRow = RowDataPacket & {
            id: number
            vendor_id: number
            vendor_name: string
            vendor_store_name: string
            name: string
            description: string
            brand: string | null
            price: number
            image_url: string | null
            stock: number
            category_id: number
            colors: string | null
            discount_percent: number
            avg_rating: number
            review_count: number
            effective_price: number
        }
        const products = await query<ProductRow>(
            `SELECT
              p.id,
              p.vendor_id,
              u.name AS vendor_name,
              COALESCE(v.store_name, u.name) AS vendor_store_name,
              p.name,
              p.description,
              p.brand,
              p.price,
              p.image_url,
              p.stock,
              p.category_id,
              p.colors,
              p.discount_percent,
              p.avg_rating,
              p.review_count,
              (p.price - (p.price * p.discount_percent / 100)) AS effective_price
            FROM products p
            JOIN users u ON u.id = p.vendor_id
            LEFT JOIN vendors v ON v.user_id = p.vendor_id
            WHERE p.category_id = ? AND p.is_active = 1
            ORDER BY p.created_at DESC, p.id DESC`,
            [categoryId]
        )
        return NextResponse.json(products)
    } catch (err) {
        console.error('Failed to load category products', err)
        return NextResponse.json({ error: 'Unable to load category products' }, { status: 500 })
    }
}
