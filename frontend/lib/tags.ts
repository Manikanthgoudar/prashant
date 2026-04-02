import { PoolConnection } from 'mysql2/promise'

const PRODUCT_TAGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS product_tags (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  tag VARCHAR(64) NOT NULL,
  normalized_tag VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_product_tag (product_id, normalized_tag),
  INDEX idx_product_tags_lookup (normalized_tag),
  CONSTRAINT fk_product_tags_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
)
`

export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function parseTagInput(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((tag): tag is string => typeof tag === 'string')
  }

  if (typeof input === 'string') {
    return input.split(',')
  }

  return []
}

export function sanitizeTags(tags: string[]): string[] {
  const byNormalized = new Map<string, string>()

  for (const rawTag of tags) {
    const normalized = normalizeTag(rawTag)
    if (!normalized) continue

    // Preserve user-facing label while deduplicating by normalized value.
    const display = rawTag
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/(^|\s)\S/g, (char) => char.toUpperCase())

    byNormalized.set(normalized, display)
  }

  return Array.from(byNormalized.values())
}

export function tagsFromCsv(csv: string | null | undefined): string[] {
  if (!csv) return []
  return csv
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export async function ensureProductTagsTable(conn: PoolConnection) {
  await conn.execute(PRODUCT_TAGS_TABLE_SQL)
}

export async function replaceProductTags(conn: PoolConnection, productId: number, tags: string[]) {
  const cleaned = sanitizeTags(tags)

  await conn.execute('DELETE FROM product_tags WHERE product_id = ?', [productId])

  if (!cleaned.length) return

  for (const tag of cleaned) {
    await conn.execute('INSERT INTO product_tags (product_id, tag, normalized_tag) VALUES (?, ?, ?)', [
      productId,
      tag,
      normalizeTag(tag)
    ])
  }
}
