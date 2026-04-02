import { NextRequest, NextResponse } from 'next/server'
import { getConnection, query } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { RowDataPacket } from 'mysql2/promise'
import { ensureProductTagsTable, parseTagInput, replaceProductTags, tagsFromCsv } from '@/lib/tags'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id: idParam } = await context.params
    const id = Number(idParam)
    if (Number.isNaN(id)) {
        return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
    }

    const conn = await getConnection()
    try {
        await ensureProductTagsTable(conn)

        type ProductRow = RowDataPacket & {
            id: number
            vendor_id: number
            vendor_name: string
            vendor_store_name: string
            name: string
            description: string
            brand: string
            price: number
            image_url: string
            stock: number
            category_id: number
            colors: string
            discount_percent: number
            avg_rating: number
            review_count: number
            category_name: string
            category_slug: string
            category_icon: string
            category_parent: number | null
            tags_csv: string | null
        }
        const [rows] = await conn.query<ProductRow[]>(
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
              c.name AS category_name,
              c.slug AS category_slug,
              c.icon AS category_icon,
                            c.parent_id AS category_parent,
                            (
                                SELECT GROUP_CONCAT(pt.tag ORDER BY pt.tag SEPARATOR ',')
                                FROM product_tags pt
                                WHERE pt.product_id = p.id
                            ) AS tags_csv
            FROM products p
            JOIN categories c ON p.category_id = c.id
            JOIN users u ON u.id = p.vendor_id
            LEFT JOIN vendors v ON v.user_id = p.vendor_id
            WHERE p.id = ?
            LIMIT 1`,
            [id]
        )

        const product = rows[0]
        if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

        const [imagesPromise, variantsPromise, recommendationsPromise] = await Promise.all([
            conn.query<Array<RowDataPacket & { id: number; image_url: string; sort_order: number }>>(
                'SELECT id, image_url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order, id',
                [id]
            ),
            conn.query<Array<RowDataPacket & { id: number; sku: string; color: string | null; size: string | null; additional_price: number; stock: number; image_url: string | null }>>(
                `SELECT id, sku, color, size, additional_price, stock, image_url
                 FROM product_variants
                 WHERE product_id = ?
                 ORDER BY color, size, id`,
                [id]
            ),
            conn.query<Array<RowDataPacket & { id: number; name: string; image_url: string | null; price: number; discount_percent: number; avg_rating: number }>>(
                `SELECT id, name, image_url, price, discount_percent, avg_rating
                 FROM products
                 WHERE category_id = ? AND id <> ? AND is_active = 1
                 ORDER BY avg_rating DESC, review_count DESC, created_at DESC
                 LIMIT 8`,
                [product.category_id, id]
            )
        ])

        const images = imagesPromise[0]
        const variants = variantsPromise[0]
        const recommendations = recommendationsPromise[0]

        const effectivePrice = Number(product.price) - (Number(product.price) * Number(product.discount_percent || 0)) / 100
        const { tags_csv, ...productWithoutTagsCsv } = product

        return NextResponse.json({
            ...productWithoutTagsCsv,
            tags: tagsFromCsv(tags_csv),
            effective_price: Number(effectivePrice.toFixed(2)),
            category: {
                id: product.category_id,
                name: product.category_name,
                slug: product.category_slug,
                icon: product.category_icon,
                parent_id: product.category_parent
            },
            images: images.length ? images : product.image_url ? [{ id: 0, image_url: product.image_url, sort_order: 0 }] : [],
            variants,
            recommendations: recommendations.map((item) => ({
                ...item,
                effective_price: Number(item.price) - (Number(item.price) * Number(item.discount_percent || 0)) / 100
            }))
        })
    } catch (err) {
        console.error('Failed to load product', err)
        return NextResponse.json({ error: 'Unable to load product' }, { status: 500 })
    } finally {
        conn.release()
    }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { user, error } = await requireAuth(req, ['vendor', 'admin'])
    if (!user) return error as NextResponse

    const { id: idParam } = await context.params
    const id = Number(idParam)
    if (Number.isNaN(id)) {
        return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
    }

    const body = await req.json()
    const incomingTags = parseTagInput(body?.tags)
    const hasTagUpdate = body?.tags !== undefined

    const conn = await getConnection()

    try {
        await conn.beginTransaction()
        await ensureProductTagsTable(conn)

        const [rows] = await conn.query<any[]>('SELECT id, vendor_id FROM products WHERE id = ? LIMIT 1 FOR UPDATE', [id])
        const product = rows[0]
        if (!product) {
            await conn.rollback()
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        if (user.role === 'vendor' && Number(product.vendor_id) !== user.id) {
            await conn.rollback()
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const updates: string[] = []
        const params: any[] = []

        const fields = ['name', 'description', 'brand', 'price', 'image_url', 'stock', 'discount_percent', 'is_active', 'colors', 'category_id']
        for (const field of fields) {
            if (body[field] !== undefined) {
                updates.push(`${field} = ?`)
                params.push(body[field])
            }
        }

        if (!updates.length && !hasTagUpdate) {
            await conn.rollback()
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
        }

        if (updates.length) {
            params.push(id)
            await conn.execute(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params)
        }

        if (hasTagUpdate) {
            await replaceProductTags(conn, id, incomingTags)
        }

        await conn.commit()

        return NextResponse.json({ ok: true })
    } catch (err) {
        await conn.rollback()
        console.error('Failed to update product', err)
        return NextResponse.json({ error: 'Unable to update product' }, { status: 500 })
    } finally {
        conn.release()
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { user, error } = await requireAuth(req, ['vendor', 'admin'])
    if (!user) return error as NextResponse

    const { id: idParam } = await context.params
    const id = Number(idParam)
    if (Number.isNaN(id)) {
        return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
    }

    try {
        const rows = await query<any>('SELECT id, vendor_id FROM products WHERE id = ? LIMIT 1', [id])
        const product = rows[0]
        if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

        if (user.role === 'vendor' && Number(product.vendor_id) !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        await query<any>('UPDATE products SET is_active = 0 WHERE id = ?', [id])
        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error('Failed to deactivate product', err)
        return NextResponse.json({ error: 'Unable to deactivate product' }, { status: 500 })
    }
}
