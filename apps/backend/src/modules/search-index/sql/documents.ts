import type { DocumentInput, Executor, StoredDocument } from "../types"

/**
 * The index's rows (adr/0056), written by the indexing workflow. Every
 * value is bound: lists and rows go in as one JSON parameter each and are
 * read back in SQL (`jsonb_to_recordset`), so no statement is built from
 * what a product holds. The weighted `tsvector` is made in the database
 * from the stored fields (`search_index_document`), so a later change of
 * configuration rebuilds it without reading the catalogue.
 */

/** Words longer than this are no shopper's words (a pasted string, a hash): not in the dictionary. */
const MAX_WORD = 64

export const idList = (ids: readonly string[]): string => JSON.stringify([...new Set(ids)])

/** `ARRAY(...)` of a JSON list parameter, as `text[]`. */
export const TEXT_ARRAY = "ARRAY(SELECT jsonb_array_elements_text(?::jsonb))"

const COLUMNS = `product_id, published, title, fields, vocabulary, sales_channel_ids,
  category_ids, categories, collection_id, brand_id, brand_handle, brand_name, options,
  prices, in_stock, on_sale, product_created_at`

/** Writes the rows (new or again); popularity stays unless a row gives it. */
export async function upsertDocuments(db: Executor, docs: readonly DocumentInput[]) {
  if (docs.length === 0) {
    return
  }
  const rows = JSON.stringify([...docs].sort((a, b) => (a.product_id < b.product_id ? -1 : 1)))
  await db.execute(
    `WITH input AS (
       SELECT * FROM jsonb_to_recordset(?::jsonb) AS r(
         product_id text, published boolean, title text, fields jsonb, vocabulary jsonb,
         sales_channel_ids jsonb, category_ids jsonb, categories jsonb, collection_id text,
         brand jsonb, options jsonb, prices jsonb, in_stock boolean, on_sale boolean,
         product_created_at timestamptz)
     )
     INSERT INTO search_document AS d (${COLUMNS}, document, indexed_at)
     SELECT i.product_id, i.published, i.title, i.fields, i.vocabulary,
            ARRAY(SELECT jsonb_array_elements_text(i.sales_channel_ids)),
            ARRAY(SELECT jsonb_array_elements_text(i.category_ids)),
            i.categories, i.collection_id,
            i.brand->>'id', i.brand->>'handle', i.brand->>'name',
            ARRAY(SELECT jsonb_array_elements_text(i.options)),
            i.prices, i.in_stock, coalesce(i.on_sale, false), i.product_created_at,
            search_index_document(i.fields), now()
       FROM input i
     ON CONFLICT (product_id) DO UPDATE SET
       published = EXCLUDED.published, title = EXCLUDED.title, fields = EXCLUDED.fields,
       vocabulary = EXCLUDED.vocabulary, sales_channel_ids = EXCLUDED.sales_channel_ids,
       category_ids = EXCLUDED.category_ids, categories = EXCLUDED.categories,
       collection_id = EXCLUDED.collection_id, brand_id = EXCLUDED.brand_id,
       brand_handle = EXCLUDED.brand_handle, brand_name = EXCLUDED.brand_name,
       options = EXCLUDED.options, prices = EXCLUDED.prices, in_stock = EXCLUDED.in_stock,
       on_sale = EXCLUDED.on_sale, product_created_at = EXCLUDED.product_created_at,
       document = EXCLUDED.document, indexed_at = now()`,
    [rows]
  )
  const popular = docs.filter((doc) => doc.popularity !== undefined)
  if (popular.length > 0) {
    await db.execute(
      `UPDATE search_document d SET popularity = p.popularity
         FROM jsonb_to_recordset(?::jsonb) AS p(product_id text, popularity integer)
        WHERE d.product_id = p.product_id`,
      [JSON.stringify(popular.map(({ product_id, popularity }) => ({ product_id, popularity })))]
    )
  }
  // New words are offered for typos at once; their counts are made exact by refreshWords
  await db.execute(
    `INSERT INTO search_word (word, display, title_docs, docs)
     SELECT v->>0, (array_agg(v->>1 ORDER BY (v->>2)::boolean DESC, v->>1))[1],
            count(*) FILTER (WHERE (v->>2)::boolean), count(*)
       FROM jsonb_to_recordset(?::jsonb) AS i(published boolean, vocabulary jsonb),
            jsonb_array_elements(i.vocabulary) v
      WHERE i.published AND length(v->>0) BETWEEN 1 AND ${String(MAX_WORD)}
      GROUP BY v->>0
      ORDER BY v->>0
     ON CONFLICT (word) DO UPDATE SET
       display = CASE WHEN EXCLUDED.title_docs > 0 AND search_word.title_docs = 0
                      THEN EXCLUDED.display ELSE search_word.display END,
       title_docs = GREATEST(search_word.title_docs, EXCLUDED.title_docs),
       docs = GREATEST(search_word.docs, EXCLUDED.docs)`,
    [rows]
  )
}

interface Row {
  product_id: string
  published: boolean
  title: string
  fields: DocumentInput["fields"]
  vocabulary: DocumentInput["vocabulary"]
  sales_channel_ids: string[]
  category_ids: string[]
  categories: DocumentInput["categories"]
  collection_id: string | null
  brand_id: string | null
  brand_handle: string | null
  brand_name: string | null
  options: string[]
  prices: Record<string, number>
  in_stock: boolean
  on_sale: boolean
  popularity: number
  product_created_at: Date | string
}

/** The rows as stored, to put back if a later step fails. */
export async function readDocuments(
  db: Executor,
  productIds: readonly string[]
): Promise<StoredDocument[]> {
  if (productIds.length === 0) {
    return []
  }
  const rows = (await db.execute(
    `SELECT ${COLUMNS}, popularity FROM search_document WHERE product_id = ANY(${TEXT_ARRAY})`,
    [idList(productIds)]
  )) as Row[]
  return rows.map((row) => ({
    product_id: row.product_id,
    published: row.published,
    title: row.title,
    fields: row.fields,
    vocabulary: row.vocabulary,
    sales_channel_ids: row.sales_channel_ids,
    category_ids: row.category_ids,
    categories: row.categories,
    collection_id: row.collection_id,
    brand:
      row.brand_id && row.brand_handle
        ? { id: row.brand_id, handle: row.brand_handle, name: row.brand_name ?? "" }
        : null,
    options: row.options,
    prices: row.prices,
    in_stock: row.in_stock,
    on_sale: row.on_sale,
    popularity: row.popularity,
    product_created_at: new Date(row.product_created_at).toISOString(),
  }))
}

export async function deleteDocuments(db: Executor, productIds: readonly string[]) {
  if (productIds.length > 0) {
    await db.execute(`DELETE FROM search_document WHERE product_id = ANY(${TEXT_ARRAY})`, [
      idList(productIds),
    ])
  }
}

/** The products whose rows name this category or brand: what its rename or removal touches. */
export async function documentsOf(
  db: Executor,
  of: { category_id: string } | { brand_id: string }
): Promise<string[]> {
  const rows = (await ("category_id" in of
    ? db.execute(`SELECT product_id FROM search_document WHERE category_ids @> ARRAY[?]::text[]`, [
        of.category_id,
      ])
    : db.execute(`SELECT product_id FROM search_document WHERE brand_id = ?`, [of.brand_id]))) as {
    product_id: string
  }[]
  return rows.map((row) => row.product_id)
}

/** Every indexed product, a page at a time in id order (the nightly check). */
export async function documentIds(db: Executor, after: string, take: number): Promise<string[]> {
  const rows = (await db.execute(
    `SELECT product_id FROM search_document WHERE product_id > ? ORDER BY product_id LIMIT ?`,
    [after, take]
  )) as { product_id: string }[]
  return rows.map((row) => row.product_id)
}

/** Orders change a product's popularity by `delta` (an order placed: +1; undone: -1). */
export async function bumpPopularity(db: Executor, productIds: readonly string[], delta: number) {
  if (productIds.length > 0) {
    await db.execute(
      `UPDATE search_document SET popularity = GREATEST(0, popularity + ?)
        WHERE product_id = ANY(${TEXT_ARRAY})`,
      [delta, idList(productIds)]
    )
  }
}

/** Every row's popularity from a fresh count (the nightly job): products not counted have none. */
export async function setPopularity(db: Executor, counts: Readonly<Record<string, number>>) {
  const result = (await db.execute(
    `UPDATE search_document SET popularity = coalesce((?::jsonb ->> product_id)::integer, 0)
      WHERE popularity IS DISTINCT FROM coalesce((?::jsonb ->> product_id)::integer, 0)
      RETURNING product_id`,
    [JSON.stringify(counts), JSON.stringify(counts)]
  )) as unknown[]
  return result.length
}

/** The dictionary made again from the published rows: exact counts, gone words dropped. */
export async function refreshWords(db: Executor): Promise<number> {
  await db.execute(
    `CREATE TEMP TABLE search_word_fresh ON COMMIT DROP AS
       SELECT v->>0 AS word, (array_agg(v->>1 ORDER BY (v->>2)::boolean DESC, v->>1))[1] AS display,
              count(*) FILTER (WHERE (v->>2)::boolean)::integer AS title_docs,
              count(*)::integer AS docs
         FROM search_document d, jsonb_array_elements(d.vocabulary) v
        WHERE d.published AND length(v->>0) BETWEEN 1 AND ${String(MAX_WORD)}
        GROUP BY v->>0`,
    []
  )
  await db.execute(
    `DELETE FROM search_word w WHERE NOT EXISTS (SELECT 1 FROM search_word_fresh f WHERE f.word = w.word)`,
    []
  )
  const rows = (await db.execute(
    `INSERT INTO search_word (word, display, title_docs, docs)
     SELECT word, display, title_docs, docs FROM search_word_fresh ORDER BY word
     ON CONFLICT (word) DO UPDATE SET display = EXCLUDED.display,
       title_docs = EXCLUDED.title_docs, docs = EXCLUDED.docs
     RETURNING word`,
    []
  )) as unknown[]
  return rows.length
}
