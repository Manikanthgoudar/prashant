import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { effectiveProductPrice } from '@/lib/marketplace'
import { RowDataPacket } from 'mysql2/promise'
import { ensureProductTagsTable, normalizeTag, parseTagInput, replaceProductTags, tagsFromCsv } from '@/lib/tags'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('category_id')
    const q = searchParams.get('q')
    const minPrice = searchParams.get('min_price')
    const maxPrice = searchParams.get('max_price')
    const brand = searchParams.get('brand')
    const rating = searchParams.get('rating')
    const discount = searchParams.get('discount')
    const freeDelivery = searchParams.get('free_delivery')
    const sort = searchParams.get('sort') || 'newest'
    const vendorId = searchParams.get('vendor_id')
    const tag = searchParams.get('tag') || searchParams.get('tags')
    const includeInactive = searchParams.get('include_inactive') === 'true'

    const normalizedTags = (tag || '')
        .split(',')
        .map((item) => normalizeTag(item))
        .filter(Boolean)

    const clauses: string[] = []
    const params: Array<string | number> = []

    if (!includeInactive) {
        clauses.push('p.is_active = 1')
    }

    if (categoryId) {
        clauses.push('(p.category_id = ? OR c.parent_id = ?)')
        params.push(Number(categoryId), Number(categoryId))
    }

    if (vendorId) {
        clauses.push('p.vendor_id = ?')
        params.push(Number(vendorId))
    }

    if (q) {
        clauses.push('(p.name LIKE ? OR p.description LIKE ? OR p.brand LIKE ?)')
        params.push(`%${q}%`, `%${q}%`, `%${q}%`)
    }

    if (minPrice) {
        clauses.push('(p.price - (p.price * p.discount_percent / 100)) >= ?')
        params.push(Number(minPrice))
    }

    if (maxPrice) {
        clauses.push('(p.price - (p.price * p.discount_percent / 100)) <= ?')
        params.push(Number(maxPrice))
    }

    if (brand) {
        clauses.push('p.brand = ?')
        params.push(brand)
    }

    if (rating) {
        clauses.push('p.avg_rating >= ?')
        params.push(Number(rating))
    }

    if (discount) {
        clauses.push('p.discount_percent >= ?')
        params.push(Number(discount))
    }

    if (freeDelivery === 'true') {
        clauses.push('(p.price - (p.price * p.discount_percent / 100)) >= 500')
    }

    if (normalizedTags.length) {
        clauses.push(
            `EXISTS (
                SELECT 1
                FROM product_tags ptf
                WHERE ptf.product_id = p.id
                  AND ptf.normalized_tag IN (${normalizedTags.map(() => '?').join(',')})
            )`
        )
        params.push(...normalizedTags)
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const sortSqlMap: Record<string, string> = {
        price_asc: 'effective_price ASC',
        price_desc: 'effective_price DESC',
        popularity: 'p.review_count DESC, p.avg_rating DESC',
        rating: 'p.avg_rating DESC, p.review_count DESC',
        newest: 'p.created_at DESC, p.id DESC'
    }
    const orderBy = sortSqlMap[sort] || sortSqlMap.newest

    const sql = `
      SELECT
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
        c.name AS category_name,
        p.colors,
        p.discount_percent,
        p.avg_rating,
        p.review_count,
        (p.price - (p.price * p.discount_percent / 100)) AS effective_price,
                (
                    SELECT GROUP_CONCAT(pt.tag ORDER BY pt.tag SEPARATOR ',')
                    FROM product_tags pt
                    WHERE pt.product_id = p.id
                ) AS tags_csv,
        CASE WHEN (p.price - (p.price * p.discount_percent / 100)) >= 500 THEN 1 ELSE 0 END AS free_delivery
      FROM products p
      JOIN users u ON u.id = p.vendor_id
      LEFT JOIN vendors v ON v.user_id = p.vendor_id
      LEFT JOIN categories c ON c.id = p.category_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT 300
    `

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
            category_name: string
            colors: string | null
            discount_percent: number
            avg_rating: number
            review_count: number
            effective_price: number
            tags_csv: string | null
            free_delivery: number
        }
        const conn = await getConnection()
        try {
            await ensureProductTagsTable(conn)

            const [products] = await conn.query<ProductRow[]>(sql, params)

            const productIds = products.map((product) => product.id)
            let imagesByProduct = new Map<number, string[]>()
            if (productIds.length) {
                const [imageRows] = await conn.query<Array<RowDataPacket & { product_id: number; image_url: string }>>(
                    `SELECT product_id, image_url
                     FROM product_images
                     WHERE product_id IN (${productIds.map(() => '?').join(',')})
                     ORDER BY product_id, sort_order, id`,
                    productIds
                )

                imagesByProduct = imageRows.reduce((acc, row) => {
                    const existing = acc.get(row.product_id) || []
                    existing.push(row.image_url)
                    acc.set(row.product_id, existing)
                    return acc
                }, new Map<number, string[]>())
            }

            const mapped = products.map((product) => {
                const { tags_csv, ...rest } = product
                return {
                    ...rest,
                    tags: tagsFromCsv(tags_csv),
                    image_url: product.image_url || imagesByProduct.get(product.id)?.[0] || '',
                    images: imagesByProduct.get(product.id) || (product.image_url ? [product.image_url] : []),
                    free_delivery: Boolean(product.free_delivery)
                }
            })

            return NextResponse.json(mapped)
        } finally {
            conn.release()
        }
    } catch (err) {
        console.error('Failed to load products', err)
        return NextResponse.json({ error: 'Unable to load products' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const { user, error } = await requireAuth(req, ['vendor', 'admin'])
    if (!user) return error as NextResponse

    const body = await req.json()
    const name = String(body?.name || '').trim()
    const description = String(body?.description || '').trim()
    const brand = String(body?.brand || '').trim() || null
    const categoryId = Number(body?.category_id)
    const price = Number(body?.price)
    const stock = Number(body?.stock || 0)
    const discountPercent = Number(body?.discount_percent || 0)
    const images = Array.isArray(body?.images) ? body.images.filter((item: unknown) => typeof item === 'string') : []
    const variants = Array.isArray(body?.variants) ? body.variants : []
    const tags = parseTagInput(body?.tags)

    if (!name || Number.isNaN(categoryId) || Number.isNaN(price)) {
        return NextResponse.json({ error: 'name, category_id and price are required' }, { status: 400 })
    }

    const conn = await getConnection()
    try {
        await conn.beginTransaction()
        await ensureProductTagsTable(conn)

        const [insertProduct] = await conn.execute<any>(
            `INSERT INTO products (
              vendor_id, category_id, name, description, brand, price, image_url, stock, discount_percent, colors
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user.id,
                categoryId,
                name,
                description || null,
                brand,
                price,
                images[0] || body?.image_url || null,
                stock,
                discountPercent,
                body?.colors || null
            ]
        )

        const productId = Number(insertProduct.insertId)

        if (images.length) {
            for (let index = 0; index < images.length; index += 1) {
                await conn.execute('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)', [
                    productId,
                    images[index],
                    index
                ])
            }
        }

        if (variants.length) {
            const uniqueColors = new Set<string>()
            let totalStockFromVariants = 0

            for (let index = 0; index < variants.length; index += 1) {
                const variant = variants[index]
                const color = variant?.color ? String(variant.color).trim() : null
                const size = variant?.size ? String(variant.size).trim() : null
                const additionalPrice = Number(variant?.additional_price || 0)
                const variantStock = Number(variant?.stock || 0)
                const sku = String(variant?.sku || `SKU-${productId}-${index + 1}`)

                if (color) uniqueColors.add(color)
                totalStockFromVariants += variantStock

                await conn.execute(
                    `INSERT INTO product_variants (product_id, sku, color, size, additional_price, stock, image_url)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [productId, sku, color, size, additionalPrice, variantStock, variant?.image_url || null]
                )
            }

            await conn.execute('UPDATE products SET stock = ?, colors = ? WHERE id = ?', [
                totalStockFromVariants,
                Array.from(uniqueColors).join(','),
                productId
            ])
        }

        await replaceProductTags(conn, productId, tags)

        await conn.commit()

        return NextResponse.json({
            ok: true,
            product_id: productId,
            effective_price: effectiveProductPrice(price, discountPercent)
        })
    } catch (err) {
        await conn.rollback()
        console.error('Failed to create product', err)
        return NextResponse.json({ error: 'Unable to create product' }, { status: 500 })
    } finally {
        conn.release()
    }
}
