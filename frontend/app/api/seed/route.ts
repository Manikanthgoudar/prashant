import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/db'
import { RowDataPacket } from 'mysql2/promise'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    const seedToken = process.env.SEED_TOKEN || 'dev-seed'
    const incoming = req.headers.get('x-seed-token') || new URL(req.url).searchParams.get('token')
    if (incoming !== seedToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conn = await getConnection()

    try {
        await conn.beginTransaction()

        type CountRow = RowDataPacket & { cnt: number }
        const [catCountRows] = await conn.query<CountRow[]>(`SELECT COUNT(*) AS cnt FROM categories`)
        const [prodCountRows] = await conn.query<CountRow[]>(`SELECT COUNT(*) AS cnt FROM products`)

        let categoriesInserted = 0
        let productsInserted = 0

        if (catCountRows[0]?.cnt === 0) {
            // Icons kept ASCII to avoid charset issues in MySQL defaults
            await conn.query(
                `INSERT INTO categories (id, name, icon, parent_id) VALUES
          (1, 'Electronics', 'electronics', NULL),
          (2, 'Fashion', 'fashion', NULL),
          (3, 'Footwear', 'footwear', NULL),
          (4, 'Furniture', 'furniture', NULL),
          (5, 'Beauty', 'beauty', NULL)`
            )
            categoriesInserted = 5
        }

        if (prodCountRows[0]?.cnt === 0) {
            await conn.query(
                `INSERT INTO products (name, description, price, image_url, stock, category_id, colors) VALUES
          ('Aurora Ultrabook 14"', 'Featherlight laptop with 12-core CPU and all-day battery.', 89999, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800', 50, 1, 'silver,spacegray'),
          ('Nebula Pro 16"', 'Creator-grade laptop with OLED display and RTX graphics.', 159999, 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800', 30, 1, 'black,navy'),
          ('PixelWave X', 'Flagship phone with 200MP camera and AI imaging.', 74999, 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800', 120, 1, 'blue,black,white'),
          ('EchoBuds Air', 'Adaptive ANC earbuds with spatial audio.', 12999, 'https://images.unsplash.com/photo-1518442332885-05db0cd784b8?w=800', 200, 1, 'white,black'),
          ('DriftFlex Tee', 'Ultra-soft tee with four-way stretch.', 1499, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800', 300, 2, 'black,white,gray'),
          ('TrailWeave Jacket', 'Water-resistant shell with packable hood.', 6999, 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?w=800', 110, 2, 'olive,navy,black'),
          ('StrideRunner Pro', 'Lightweight daily trainer with responsive foam.', 8999, 'https://images.unsplash.com/photo-1528701800489-20be9c1f1efe?w=800', 140, 3, 'black,white,blue'),
          ('Summit Hiker GTX', 'Waterproof hiking boot with Vibram sole.', 12999, 'https://images.unsplash.com/photo-1529946825183-3367e4a27cc1?w=800', 90, 3, 'brown,olive'),
          ('Haven Lounge Chair', 'Mid-century lounge chair with solid wood frame.', 25999, 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800', 40, 4, 'walnut'),
          ('Glow Serum C', 'Vitamin C brightening serum with peptides.', 1999, 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800', 220, 5, 'amber')`
            )
            productsInserted = 10
        }

        await conn.commit()

        return NextResponse.json({ ok: true, categoriesInserted, productsInserted })
    } catch (err) {
        await conn.rollback()
        console.error('Seeding failed', err)
        return NextResponse.json({ error: 'Seeding failed' }, { status: 500 })
    } finally {
        conn.release()
    }
}
