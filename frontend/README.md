This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Backend API (MySQL + Next.js route handlers)

1) Install deps: `npm install`
2) Create DB and tables: `mysql -u mahi -p < ../backend/schema.sql` (database: `foodspot`).
3) Copy `.env.example` to `.env.local` and set `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME/JWT_SECRET`.
4) Start dev server: `npm run dev` (uses the same-origin API under `/api`).

Key endpoints (all JSON):
- `GET /api/categories` – list categories
- `GET /api/products?category_id=&q=` – list/search products
- `GET /api/product/:id` – product with category
- `GET /api/categories/:id/products` – products for a category
- `POST /api/orders` – create order `{ userId?, items:[{productId, quantity, color?}] }`
- `GET /api/orders/:id` – order detail with items
- `POST /api/signup` – `{ name, email, password }`
- `POST /api/login` – `{ email, password }`
- `GET /api/me` – bearer token in `Authorization`
- `POST /api/seed` – seeds sample categories/products (send `x-seed-token: <SEED_TOKEN>` or `?token=`)

## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
