import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/db'
import { RowDataPacket } from 'mysql2/promise'
import { hashPassword } from '@/lib/auth'
import { ensureProductTagsTable, replaceProductTags } from '@/lib/tags'

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
        await ensureProductTagsTable(conn)

        type CountRow = RowDataPacket & { cnt: number }
        const [catCountRows] = await conn.query<CountRow[]>('SELECT COUNT(*) AS cnt FROM categories')
        const [prodCountRows] = await conn.query<CountRow[]>('SELECT COUNT(*) AS cnt FROM products')
        const [userCountRows] = await conn.query<CountRow[]>('SELECT COUNT(*) AS cnt FROM users')

        let categoriesInserted = 0
        let productsInserted = 0
        let usersInserted = 0
        let variantsInserted = 0

        if (userCountRows[0]?.cnt === 0) {
            const defaultPassword = await hashPassword('password123')

            await conn.execute(
                `INSERT INTO users (name, email, password_hash, role, commission_rate) VALUES
                 ('Platform Admin', 'admin@stella.local', ?, 'admin', 10),
                 ('Urban Threads Seller', 'vendor1@stella.local', ?, 'vendor', 10),
                 ('TechNest Seller', 'vendor2@stella.local', ?, 'vendor', 10),
                 ('HomeCraft Seller', 'vendor3@stella.local', ?, 'vendor', 10),
                 ('Demo Customer', 'customer@stella.local', ?, 'customer', 10)`,
                [defaultPassword, defaultPassword, defaultPassword, defaultPassword, defaultPassword]
            )

            const [vendorUsers] = await conn.query<any[]>(
                `SELECT id, email FROM users WHERE role = 'vendor' ORDER BY id`
            )

            for (const vendor of vendorUsers) {
                const storeName =
                    vendor.email === 'vendor1@stella.local'
                        ? 'Urban Threads'
                        : vendor.email === 'vendor2@stella.local'
                            ? 'TechNest'
                            : 'HomeCraft Hub'

                await conn.execute(
                    `INSERT INTO vendors (user_id, store_name, description, status, payout_upi)
                     VALUES (?, ?, ?, 'active', ?)`,
                    [vendor.id, storeName, `${storeName} official marketplace store`, `${storeName.toLowerCase().replace(/\s+/g, '')}@upi`]
                )
            }

            usersInserted = 5
        }

        if (catCountRows[0]?.cnt === 0) {
            const rootCategories = [
                'Men',
                'Women',
                'Kids',
                'Electronics',
                'Home & Living',
                'Beauty & Personal Care'
            ]

            const childrenByRoot: Record<string, string[]> = {
                Men: ['Men Tops', 'Men Bottoms', 'Men Footwear', 'Men Accessories'],
                Women: ['Women Tops', 'Women Bottoms', 'Women Ethnic Wear', 'Women Footwear', 'Women Accessories'],
                Kids: ['Kids Clothing', 'Kids Footwear', 'Kids Toys', 'Kids Baby Care'],
                Electronics: ['Mobiles', 'Laptops', 'Audio'],
                'Home & Living': ['Furniture', 'Kitchen', 'Decor'],
                'Beauty & Personal Care': ['Skincare', 'Makeup', 'Haircare']
            }

            const rootIdByName = new Map<string, number>()

            for (const rootName of rootCategories) {
                const slug = rootName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                const [rootInsert] = await conn.execute<any>(
                    'INSERT INTO categories (name, slug, icon, parent_id) VALUES (?, ?, ?, NULL)',
                    [rootName, slug, slug]
                )
                rootIdByName.set(rootName, Number(rootInsert.insertId))
                categoriesInserted += 1
            }

            for (const [rootName, children] of Object.entries(childrenByRoot)) {
                const parentId = rootIdByName.get(rootName)
                if (!parentId) continue

                for (const childName of children) {
                    const slug = `${rootName}-${childName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                    await conn.execute('INSERT INTO categories (name, slug, icon, parent_id) VALUES (?, ?, ?, ?)', [
                        childName,
                        slug,
                        childName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                        parentId
                    ])
                    categoriesInserted += 1
                }
            }
        }

        if (prodCountRows[0]?.cnt === 0) {
            const [vendorRows] = await conn.query<any[]>(
                "SELECT id, email FROM users WHERE role = 'vendor' ORDER BY id"
            )

            const vendorByEmail = new Map<string, number>()
            vendorRows.forEach((vendor) => vendorByEmail.set(String(vendor.email), Number(vendor.id)))

            const [categoryRows] = await conn.query<any[]>('SELECT id, name, parent_id FROM categories')
            const categoryIdByName = new Map<string, number>()
            categoryRows.forEach((category) => categoryIdByName.set(String(category.name), Number(category.id)))

            const seedProducts = [
                {
                    vendorEmail: 'vendor2@stella.local',
                    category: 'Laptops',
                    name: 'NebulaBook Air 14',
                    description: 'Ultra-light laptop for study, coding, and business travel.',
                    brand: 'TechNest',
                    price: 74999,
                    stock: 45,
                    discount: 10,
                    colors: 'silver,gray,black',
                    tags: ['Electronics', 'Laptop', 'Work', 'Premium', 'Unisex'],
                    images: [
                        'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1000',
                        'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor2@stella.local',
                    category: 'Mobiles',
                    name: 'PixelNova X',
                    description: 'Premium 5G smartphone with pro camera and all-day battery.',
                    brand: 'PixelNova',
                    price: 59999,
                    stock: 80,
                    discount: 8,
                    colors: 'blue,black,white',
                    tags: ['Electronics', 'Mobile', 'Camera', '5G', 'Unisex'],
                    images: [
                        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1000',
                        'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor2@stella.local',
                    category: 'Audio',
                    name: 'SonicWave ANC Earbuds',
                    description: 'Noise-cancelling wireless earbuds tuned for calls and travel.',
                    brand: 'SonicWave',
                    price: 4999,
                    stock: 110,
                    discount: 14,
                    colors: 'black,white,teal',
                    tags: ['Electronics', 'Audio', 'Earbuds', 'Wireless', 'Travel'],
                    images: [
                        'https://images.unsplash.com/photo-1606220838315-056192d5e927?w=1000',
                        'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor1@stella.local',
                    category: 'Men Tops',
                    name: 'AeroFlex Polo Tee',
                    description: 'Breathable polo for office-casual and weekend wear.',
                    brand: 'Urban Threads',
                    price: 1499,
                    stock: 0,
                    discount: 12,
                    colors: 'navy,olive,white',
                    tags: ['Men', 'Tops', 'Cotton', 'Casual', 'Summer'],
                    images: [
                        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1000',
                        'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=1000'
                    ],
                    generateMatrixVariants: true,
                    variantSkuPrefix: 'M-POLO',
                    variantColors: ['Navy', 'Olive', 'White'],
                    variantSizes: ['S', 'M', 'L', 'XL']
                },
                {
                    vendorEmail: 'vendor1@stella.local',
                    category: 'Men Bottoms',
                    name: 'TrailEdge Cargo Joggers',
                    description: 'Utility joggers with stretch waist and multiple pockets.',
                    brand: 'Urban Threads',
                    price: 1999,
                    stock: 72,
                    discount: 9,
                    colors: 'black,khaki,gray',
                    tags: ['Men', 'Bottoms', 'Joggers', 'Streetwear', 'Travel'],
                    images: [
                        'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=1000',
                        'https://images.unsplash.com/photo-1617952236317-8c4d6d5d7b57?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor1@stella.local',
                    category: 'Men Footwear',
                    name: 'CityStride Sneakers',
                    description: 'Daily comfort sneakers for commute, gym, and long walks.',
                    brand: 'Urban Steps',
                    price: 2999,
                    stock: 120,
                    discount: 15,
                    colors: 'black,white,gray',
                    tags: ['Men', 'Footwear', 'Sneakers', 'Running', 'Casual'],
                    images: [
                        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1000',
                        'https://images.unsplash.com/photo-1528701800489-20be9c1f1efe?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor1@stella.local',
                    category: 'Women Ethnic Wear',
                    name: 'Blossom Kurta Set',
                    description: 'Soft rayon kurta set for festive and office events.',
                    brand: 'Urban Threads',
                    price: 2499,
                    stock: 0,
                    discount: 11,
                    colors: 'pink,maroon,mustard',
                    tags: ['Women', 'Ethnic', 'Kurta', 'Festive', 'Comfort'],
                    images: [
                        'https://images.unsplash.com/photo-1610189020370-7e0fa77f75f3?w=1000',
                        'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=1000'
                    ],
                    generateMatrixVariants: true,
                    variantSkuPrefix: 'W-KURTA',
                    variantColors: ['Rose', 'Maroon', 'Mustard'],
                    variantSizes: ['S', 'M', 'L', 'XL']
                },
                {
                    vendorEmail: 'vendor1@stella.local',
                    category: 'Women Bottoms',
                    name: 'SculptFit Leggings',
                    description: 'High-waist stretch leggings built for yoga and training.',
                    brand: 'Urban Active',
                    price: 1799,
                    stock: 95,
                    discount: 10,
                    colors: 'black,wine,navy',
                    tags: ['Women', 'Bottoms', 'Athleisure', 'Gym', 'Stretch'],
                    images: [
                        'https://images.unsplash.com/photo-1506629905607-c28c0f7f89d8?w=1000',
                        'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor1@stella.local',
                    category: 'Women Footwear',
                    name: 'Aura Sling Heels',
                    description: 'Elegant low-block heels for evening and occasion wear.',
                    brand: 'Urban Steps',
                    price: 3299,
                    stock: 58,
                    discount: 13,
                    colors: 'beige,black',
                    tags: ['Women', 'Footwear', 'Heels', 'Party', 'Elegant'],
                    images: [
                        'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=1000',
                        'https://images.unsplash.com/photo-1449505278894-297fdb3edbc1?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor1@stella.local',
                    category: 'Kids Clothing',
                    name: 'Kids Dino Graphic Tee',
                    description: 'Soft cotton tee with playful dinosaur print.',
                    brand: 'Tiny Trail',
                    price: 799,
                    stock: 0,
                    discount: 8,
                    colors: 'yellow,blue,green',
                    tags: ['Kids', 'Clothing', 'Tshirt', 'Cotton', 'Everyday'],
                    images: [
                        'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=1000',
                        'https://images.unsplash.com/photo-1503919005314-30d93d07d823?w=1000'
                    ],
                    generateMatrixVariants: true,
                    variantSkuPrefix: 'K-TEE',
                    variantColors: ['Sun Yellow', 'Sky Blue', 'Leaf Green'],
                    variantSizes: ['4Y', '6Y', '8Y', '10Y']
                },
                {
                    vendorEmail: 'vendor1@stella.local',
                    category: 'Kids Footwear',
                    name: 'Junior Sprint Shoes',
                    description: 'Lightweight velcro shoes for school and playground use.',
                    brand: 'Tiny Trail',
                    price: 1399,
                    stock: 85,
                    discount: 10,
                    colors: 'blue,gray,orange',
                    tags: ['Kids', 'Footwear', 'School', 'Play', 'Comfort'],
                    images: [
                        'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=1000',
                        'https://images.unsplash.com/photo-1543508282-6319a3e2621f?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor2@stella.local',
                    category: 'Kids Toys',
                    name: 'LearnPad Mini',
                    description: 'Kid-safe learning tablet with parental controls and stories.',
                    brand: 'TechNest Junior',
                    price: 8999,
                    stock: 60,
                    discount: 12,
                    colors: 'mint,blue',
                    tags: ['Kids', 'Learning', 'Tablet', 'Educational', 'STEM'],
                    images: [
                        'https://images.unsplash.com/photo-1517059224940-d4af9eec41e5?w=1000',
                        'https://images.unsplash.com/photo-1593642532400-2682810df593?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor3@stella.local',
                    category: 'Furniture',
                    name: 'Nordic Lounge Chair',
                    description: 'Comfortable modern chair with walnut finish and soft cushion.',
                    brand: 'HomeCraft',
                    price: 10999,
                    stock: 30,
                    discount: 5,
                    colors: 'walnut,beige',
                    tags: ['Home', 'Furniture', 'Living Room', 'Wood', 'Minimal'],
                    images: [
                        'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=1000',
                        'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor3@stella.local',
                    category: 'Kitchen',
                    name: 'ChefPro Nonstick Cookware Set',
                    description: '7-piece nonstick cookware set for daily family meals.',
                    brand: 'HomeCraft',
                    price: 4599,
                    stock: 52,
                    discount: 16,
                    colors: 'black,red',
                    tags: ['Home', 'Kitchen', 'Cookware', 'Family', 'Daily Use'],
                    images: [
                        'https://images.unsplash.com/photo-1584990347449-a4d6f1f5dd9b?w=1000',
                        'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor3@stella.local',
                    category: 'Decor',
                    name: 'Cloud Night Lamp',
                    description: 'Warm ambient cloud lamp for kids rooms and bedside corners.',
                    brand: 'HomeCraft Kids',
                    price: 1299,
                    stock: 68,
                    discount: 9,
                    colors: 'white,lavender',
                    tags: ['Kids', 'Decor', 'Bedroom', 'Lighting', 'Gift'],
                    images: [
                        'https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=1000',
                        'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor3@stella.local',
                    category: 'Skincare',
                    name: 'Glow Vitamin C Serum',
                    description: 'Brightening serum with stabilized vitamin C and hyaluronic acid.',
                    brand: 'LumaCare',
                    price: 899,
                    stock: 250,
                    discount: 18,
                    colors: 'amber',
                    tags: ['Beauty', 'Skincare', 'Women', 'Vitamin C', 'Glow'],
                    images: [
                        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1000',
                        'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor3@stella.local',
                    category: 'Makeup',
                    name: 'Velvet Matte Lip Kit',
                    description: 'Long-lasting matte lip shades curated for Indian skin tones.',
                    brand: 'LumaCare',
                    price: 1299,
                    stock: 140,
                    discount: 20,
                    colors: 'rose,nude,berry',
                    tags: ['Beauty', 'Makeup', 'Women', 'Lipstick', 'Party'],
                    images: [
                        'https://images.unsplash.com/photo-1526045431048-f857369baa09?w=1000',
                        'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor3@stella.local',
                    category: 'Haircare',
                    name: 'Gentle Kids Shampoo',
                    description: 'Tear-free shampoo with mild botanicals for children.',
                    brand: 'LumaCare Kids',
                    price: 549,
                    stock: 210,
                    discount: 7,
                    colors: 'mint',
                    tags: ['Kids', 'Haircare', 'Baby Care', 'Mild', 'Daily Use'],
                    images: [
                        'https://images.unsplash.com/photo-1620917669788-0f0c9f4015da?w=1000',
                        'https://images.unsplash.com/photo-1626784215021-2e39ccf971cd?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor1@stella.local',
                    category: 'Men Accessories',
                    name: 'Urban Edge Leather Wallet',
                    description: 'Slim RFID-safe wallet with quick-access card slots.',
                    brand: 'Urban Threads',
                    price: 999,
                    stock: 180,
                    discount: 10,
                    colors: 'black,brown,tan',
                    tags: ['Men', 'Accessories', 'Wallet', 'Daily Use', 'Gift'],
                    images: [
                        'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1000',
                        'https://images.unsplash.com/photo-1627123424574-724758594e93?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor1@stella.local',
                    category: 'Women Tops',
                    name: 'Breeze Linen Button Shirt',
                    description: 'Breathable relaxed-fit linen shirt for warm days and travel.',
                    brand: 'Urban Threads',
                    price: 1899,
                    stock: 0,
                    discount: 12,
                    colors: 'ivory,blue,sage',
                    tags: ['Women', 'Tops', 'Linen', 'Casual', 'Summer'],
                    images: [
                        'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=1000',
                        'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1000'
                    ],
                    generateMatrixVariants: true,
                    variantSkuPrefix: 'W-TOP',
                    variantColors: ['Ivory', 'Sky Blue', 'Sage'],
                    variantSizes: ['XS', 'S', 'M', 'L']
                },
                {
                    vendorEmail: 'vendor1@stella.local',
                    category: 'Women Accessories',
                    name: 'Luna Everyday Tote Bag',
                    description: 'Structured tote with zip pocket and roomy daily essentials compartment.',
                    brand: 'Urban Threads',
                    price: 2299,
                    stock: 95,
                    discount: 11,
                    colors: 'beige,black,olive',
                    tags: ['Women', 'Accessories', 'Bag', 'Office', 'Daily Use'],
                    images: [
                        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1000',
                        'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor3@stella.local',
                    category: 'Kids Baby Care',
                    name: 'SoftNest Baby Lotion',
                    description: 'Mild oat and shea lotion for everyday infant moisturization.',
                    brand: 'LumaCare Kids',
                    price: 399,
                    stock: 260,
                    discount: 9,
                    colors: 'cream',
                    tags: ['Kids', 'Baby Care', 'Skincare', 'Gentle', 'Daily Use'],
                    images: [
                        'https://images.unsplash.com/photo-1611080541599-8c6dbde6ed28?w=1000',
                        'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor2@stella.local',
                    category: 'Laptops',
                    name: 'VoltBook Pro 16',
                    description: 'Performance laptop with high-refresh display for creators and developers.',
                    brand: 'TechNest',
                    price: 94999,
                    stock: 28,
                    discount: 7,
                    colors: 'space-gray,silver',
                    tags: ['Electronics', 'Laptop', 'Performance', 'Creator', 'Work'],
                    images: [
                        'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1000',
                        'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor2@stella.local',
                    category: 'Mobiles',
                    name: 'NovaLite 5G',
                    description: 'Balanced 5G phone with AMOLED screen and fast charging.',
                    brand: 'PixelNova',
                    price: 32999,
                    stock: 140,
                    discount: 9,
                    colors: 'charcoal,blue,white',
                    tags: ['Electronics', 'Mobile', '5G', 'AMOLED', 'Fast Charging'],
                    images: [
                        'https://images.unsplash.com/photo-1567581935884-3349723552ca?w=1000',
                        'https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor2@stella.local',
                    category: 'Audio',
                    name: 'BassDock Party Speaker',
                    description: 'Portable Bluetooth speaker with punchy bass and 12-hour battery.',
                    brand: 'SonicWave',
                    price: 6999,
                    stock: 88,
                    discount: 13,
                    colors: 'black,navy',
                    tags: ['Electronics', 'Audio', 'Speaker', 'Bluetooth', 'Portable'],
                    images: [
                        'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=1000',
                        'https://images.unsplash.com/photo-1589003077984-894e133dabab?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor1@stella.local',
                    category: 'Men Bottoms',
                    name: 'Metro Slim Chinos',
                    description: 'Stretch cotton chinos tailored for office and smart casual wear.',
                    brand: 'Urban Threads',
                    price: 2399,
                    stock: 74,
                    discount: 10,
                    colors: 'khaki,navy,stone',
                    tags: ['Men', 'Bottoms', 'Chinos', 'Office', 'Stretch'],
                    images: [
                        'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=1000',
                        'https://images.unsplash.com/photo-1506629905607-c28c0f7f89d8?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor1@stella.local',
                    category: 'Men Footwear',
                    name: 'TrailLite Running Shoes',
                    description: 'Lightweight cushioned running shoes for daily training.',
                    brand: 'Urban Steps',
                    price: 3599,
                    stock: 96,
                    discount: 12,
                    colors: 'black,blue,lime',
                    tags: ['Men', 'Footwear', 'Running', 'Sports', 'Comfort'],
                    images: [
                        'https://images.unsplash.com/photo-1539185441755-769473a23570?w=1000',
                        'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor1@stella.local',
                    category: 'Kids Clothing',
                    name: 'PlayTime Cotton Shorts Set',
                    description: 'Two-piece breathable cotton set for active summer days.',
                    brand: 'Tiny Trail',
                    price: 1199,
                    stock: 0,
                    discount: 9,
                    colors: 'blue,orange,green',
                    tags: ['Kids', 'Clothing', 'Cotton', 'Summer', 'Set'],
                    images: [
                        'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=1000',
                        'https://images.unsplash.com/photo-1519340241574-2cec6aef0c01?w=1000'
                    ],
                    generateMatrixVariants: true,
                    variantSkuPrefix: 'K-SET',
                    variantColors: ['Ocean Blue', 'Sun Orange', 'Leaf Green'],
                    variantSizes: ['4Y', '6Y', '8Y', '10Y']
                },
                {
                    vendorEmail: 'vendor2@stella.local',
                    category: 'Kids Toys',
                    name: 'RoboBlocks STEM Builder Kit',
                    description: 'Hands-on robotics blocks set that teaches coding logic and mechanics.',
                    brand: 'TechNest Junior',
                    price: 3499,
                    stock: 92,
                    discount: 15,
                    colors: 'multicolor',
                    tags: ['Kids', 'Toys', 'STEM', 'Learning', 'Educational'],
                    images: [
                        'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=1000',
                        'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor3@stella.local',
                    category: 'Furniture',
                    name: 'FoldMate Study Desk',
                    description: 'Space-saving desk with storage shelf for home office setups.',
                    brand: 'HomeCraft',
                    price: 7999,
                    stock: 44,
                    discount: 8,
                    colors: 'oak,walnut',
                    tags: ['Home', 'Furniture', 'Study', 'Office', 'Compact'],
                    images: [
                        'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=1000',
                        'https://images.unsplash.com/photo-1595514535415-dae8f8f0e2f3?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor3@stella.local',
                    category: 'Kitchen',
                    name: 'QuickBlend Mixer Grinder',
                    description: '750W mixer grinder with stainless jars for chutneys and smoothies.',
                    brand: 'HomeCraft',
                    price: 3799,
                    stock: 66,
                    discount: 14,
                    colors: 'black,silver',
                    tags: ['Home', 'Kitchen', 'Appliance', 'Mixer', 'Daily Use'],
                    images: [
                        'https://images.unsplash.com/photo-1586208958839-06c17cacdf08?w=1000',
                        'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor3@stella.local',
                    category: 'Decor',
                    name: 'Terra Ceramic Vase Trio',
                    description: 'Set of three textured ceramic vases for modern shelf styling.',
                    brand: 'HomeCraft',
                    price: 1699,
                    stock: 112,
                    discount: 10,
                    colors: 'beige,white,terracotta',
                    tags: ['Home', 'Decor', 'Vase', 'Living Room', 'Minimal'],
                    images: [
                        'https://images.unsplash.com/photo-1616627458129-67f5f7e0e8e4?w=1000',
                        'https://images.unsplash.com/photo-1604014237800-1c9102c219da?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor3@stella.local',
                    category: 'Skincare',
                    name: 'Hydra Dew Gel Cream',
                    description: 'Lightweight gel moisturizer that hydrates and calms tired skin.',
                    brand: 'LumaCare',
                    price: 749,
                    stock: 280,
                    discount: 16,
                    colors: 'aqua',
                    tags: ['Beauty', 'Skincare', 'Hydration', 'Daily', 'Women'],
                    images: [
                        'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=1000',
                        'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor3@stella.local',
                    category: 'Makeup',
                    name: 'GlowFix Compact Duo',
                    description: 'Matte + luminous compact duo designed for long-wear touch-ups.',
                    brand: 'LumaCare',
                    price: 999,
                    stock: 175,
                    discount: 17,
                    colors: 'natural,warm-beige,honey',
                    tags: ['Beauty', 'Makeup', 'Compact', 'Face', 'Everyday'],
                    images: [
                        'https://images.unsplash.com/photo-1522338140262-f46f5913618a?w=1000',
                        'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=1000'
                    ]
                },
                {
                    vendorEmail: 'vendor3@stella.local',
                    category: 'Haircare',
                    name: 'Argan Repair Hair Mask',
                    description: 'Deep-conditioning mask for dry and damaged hair.',
                    brand: 'LumaCare',
                    price: 699,
                    stock: 190,
                    discount: 12,
                    colors: 'gold',
                    tags: ['Beauty', 'Haircare', 'Repair', 'Mask', 'Nourishing'],
                    images: [
                        'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=1000',
                        'https://images.unsplash.com/photo-1607006483224-4f80f1726d9f?w=1000'
                    ]
                }
            ]

            for (const item of seedProducts) {
                const vendorId = vendorByEmail.get(item.vendorEmail)
                const categoryId = categoryIdByName.get(item.category)
                if (!vendorId || !categoryId) continue

                const [productInsert] = await conn.execute<any>(
                    `INSERT INTO products (
                      vendor_id, category_id, name, description, brand, price, image_url, stock, colors, discount_percent
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        vendorId,
                        categoryId,
                        item.name,
                        item.description,
                        item.brand,
                        item.price,
                        item.images[0],
                        item.stock,
                        item.colors,
                        item.discount
                    ]
                )

                const productId = Number(productInsert.insertId)
                productsInserted += 1

                await replaceProductTags(conn, productId, item.tags)

                for (let index = 0; index < item.images.length; index += 1) {
                    await conn.execute('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)', [
                        productId,
                        item.images[index],
                        index
                    ])
                }

                if (item.generateMatrixVariants) {
                    const colors = item.variantColors || ['Red', 'Blue', 'Green']
                    const sizes = item.variantSizes || ['S', 'M', 'L', 'XL']
                    let totalVariantStock = 0
                    for (const color of colors) {
                        for (const size of sizes) {
                            const additionalPrice = size === 'XL' ? 120 : size === 'L' ? 80 : size === 'M' ? 40 : 0
                            const variantStock = 14
                            totalVariantStock += variantStock

                            await conn.execute(
                                `INSERT INTO product_variants (product_id, sku, color, size, additional_price, stock, image_url)
                                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    productId,
                                    `${item.variantSkuPrefix || 'SKU'}-${color.toUpperCase().replace(/\s+/g, '-')}-${size}`,
                                    color,
                                    size,
                                    additionalPrice,
                                    variantStock,
                                    item.images[0]
                                ]
                            )
                            variantsInserted += 1
                        }
                    }

                    await conn.execute('UPDATE products SET stock = ? WHERE id = ?', [totalVariantStock, productId])
                }
            }
        }

        await conn.commit()

        return NextResponse.json({
            ok: true,
            usersInserted,
            categoriesInserted,
            productsInserted,
            variantsInserted,
            demoLogins: {
                admin: { email: 'admin@stella.local', password: 'password123' },
                vendor: { email: 'vendor1@stella.local', password: 'password123' },
                customer: { email: 'customer@stella.local', password: 'password123' }
            }
        })
    } catch (err) {
        await conn.rollback()
        console.error('Seeding failed', err)
        return NextResponse.json({ error: 'Seeding failed' }, { status: 500 })
    } finally {
        conn.release()
    }
}
