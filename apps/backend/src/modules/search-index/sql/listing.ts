import type { FacetCount, ListingPlan, ListingResult } from "../types"
import { ranking } from "./ranking"
import { Statement } from "./statement"

/**
 * A listing or a search answered in one statement (adr/0056): the
 * products in scope (`m`, published, in the shopper's channels, matching
 * the query and weighed), each filter worked out once (`f`), then the
 * page, the count, every facet's counts (each filter's own values counted
 * without itself), the price range and a search's related chips, all
 * from those two materialised sets. Paged in the database: no cap on how
 * many products a listing holds. The statement's shape follows the
 * plan's (how many filters, units); every value is bound.
 */

const ORDER: Record<Exclude<ListingPlan["sort"], "ids_order">, string> = {
  relevance: "in_stock DESC, score DESC, created_at DESC, product_id",
  newest: "created_at DESC, product_id",
  price_asc: "price ASC NULLS LAST, created_at DESC, product_id",
  price_desc: "price DESC NULLS LAST, created_at DESC, product_id",
}

/**
 * The page's order. `ids_order` follows the ids given (`array_position`
 * over the bound list, worked out once per row in `f`); a product not in
 * it comes after, the newest first.
 */
const orderOf = (plan: ListingPlan): string =>
  plan.sort === "ids_order"
    ? "ord_at ASC NULLS LAST, created_at DESC, product_id"
    : ORDER[plan.sort]

/** Chips a search shows: the categories and brands most of its first hits are in. */
const RELATED_LIMIT = 5

function scopeOf(plan: ListingPlan, sql: Statement): string {
  const where: string[] = []
  const { scope } = plan
  if (plan.channels) {
    where.push(`d.sales_channel_ids && ${sql.textArray(plan.channels)}`)
  }
  if (scope.category_ids) {
    where.push(
      scope.category_ids.length > 0
        ? `d.category_ids && ${sql.textArray(scope.category_ids)}`
        : "false"
    )
  }
  if (scope.product_ids) {
    where.push(
      scope.product_ids.length > 0
        ? `d.product_id = ANY(${sql.textArray(scope.product_ids)})`
        : "false"
    )
  }
  if (scope.brand_id !== undefined) {
    where.push(`d.brand_id = ${sql.param(scope.brand_id)}`)
  }
  if (scope.collection_id !== undefined) {
    where.push(`d.collection_id = ${sql.param(scope.collection_id)}`)
  }
  if (scope.option !== undefined) {
    where.push(`d.options @> ARRAY[${sql.param(scope.option)}]::text[]`)
  }
  if (scope.on_sale) {
    where.push("d.on_sale")
  }
  if (plan.text) {
    where.push(`d.document @@ ${sql.param(plan.text.match)}::tsquery`)
  }
  return where.map((each) => `AND ${each}`).join(" ")
}

interface Condition {
  name: string
  sql: string
}

function conditionsOf(plan: ListingPlan, sql: Statement): Condition[] {
  const conditions: Condition[] = []
  const { filters, price } = plan
  if (filters.brands) {
    conditions.push({ name: "fb", sql: `brand_handle = ANY(${sql.textArray(filters.brands)})` })
  }
  filters.options.forEach((filter, at) => {
    const values = filter.values.map((value) => `${filter.key}=${value}`)
    conditions.push({ name: `fo${String(at)}`, sql: `options && ${sql.textArray(values)}` })
  })
  if (filters.in_stock) {
    conditions.push({ name: "fs", sql: "in_stock" })
  }
  if (price.min !== null || price.max !== null) {
    const ends = [
      ...(price.min !== null ? [`price >= ${sql.param(price.min)}`] : []),
      ...(price.max !== null ? [`price <= ${sql.param(price.max)}`] : []),
    ]
    conditions.push({ name: "fp", sql: `(price IS NOT NULL AND ${ends.join(" AND ")})` })
  }
  return conditions
}

const allBut = (conditions: readonly Condition[], left?: string) =>
  conditions
    .filter((condition) => condition.name !== left)
    .map((condition) => condition.name)
    .join(" AND ") || "true"

const counted = (where: string, sql: Statement, prefix?: string) =>
  `(SELECT coalesce(jsonb_object_agg(o.value, o.n), '{}'::jsonb)
      FROM (SELECT x AS value, count(*)::integer AS n FROM f, unnest(f.options) AS x
             WHERE ${where}${prefix ? ` AND starts_with(x, ${sql.param(prefix)})` : ""}
             GROUP BY x) o)`

function relatedOf(plan: ListingPlan, sql: Statement): { cte: string; select: string } | null {
  if (!plan.related) {
    return null
  }
  const cte = `, t AS (
      SELECT categories, brand_id, brand_name, brand_handle,
             row_number() OVER (ORDER BY ${ORDER.relevance}) AS ord
        FROM m ORDER BY ord LIMIT ${sql.param(plan.related)})`
  const select = `jsonb_build_object(
      'categories', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name)
                                               ORDER BY c.n DESC, c.first), '[]'::jsonb)
                       FROM (SELECT cat->>'id' AS id, min(cat->>'name') AS name,
                                    count(*) AS n, min(t.ord) AS first
                               FROM t, jsonb_array_elements(t.categories) AS cat
                              GROUP BY cat->>'id' ORDER BY n DESC, first
                              LIMIT ${String(RELATED_LIMIT)}) c),
      'brands', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', b.brand_id, 'name', b.name,
                                                             'handle', b.handle)
                                           ORDER BY b.n DESC, b.first), '[]'::jsonb)
                   FROM (SELECT brand_id, min(brand_name) AS name, min(brand_handle) AS handle,
                                count(*) AS n, min(t.ord) AS first
                           FROM t WHERE brand_id IS NOT NULL
                          GROUP BY brand_id ORDER BY n DESC, first
                          LIMIT ${String(RELATED_LIMIT)}) b)) AS related`
  return { cte, select }
}

/** The plan as one statement and its bound values. */
export function listingStatement(plan: ListingPlan): { sql: string; params: unknown[] } {
  const sql = new Statement()
  const priceKey = sql.param(plan.price.key)
  const rank = ranking(plan, sql)
  const scope = scopeOf(plan, sql)
  const conditions = conditionsOf(plan, sql)
  const flags = conditions.map((condition) => `${condition.sql} AS ${condition.name}`)
  const related = relatedOf(plan, sql)
  const all = allBut(conditions)
  const order = orderOf(plan)
  const ordAt =
    plan.sort === "ids_order"
      ? `, array_position(${sql.textArray(plan.order_ids ?? [])}, m.product_id) AS ord_at`
      : ""
  const selects = [`(SELECT count(*)::integer FROM f WHERE ${all}) AS count`]
  if (!plan.countOnly) {
    selects.push(
      `(SELECT coalesce(jsonb_agg(p.product_id ORDER BY ${order}), '[]'::jsonb)
          FROM (SELECT * FROM f WHERE ${all} ORDER BY ${order}
                 LIMIT ${sql.param(plan.page.limit)} OFFSET ${sql.param(plan.page.offset)}) p) AS ids`,
      `(SELECT coalesce(jsonb_agg(jsonb_build_array(b.brand_handle, b.name, b.n)), '[]'::jsonb)
          FROM (SELECT brand_handle, min(brand_name) AS name, count(*)::integer AS n FROM f
                 WHERE brand_handle IS NOT NULL AND ${allBut(conditions, "fb")}
                 GROUP BY brand_handle) b) AS brands`,
      `${counted(all, sql)} AS options`,
      ...plan.filters.options.map(
        (filter, at) =>
          `${counted(allBut(conditions, `fo${String(at)}`), sql, `${filter.key}=`)} AS own${String(at)}`
      ),
      `(SELECT count(*)::integer FROM f WHERE in_stock AND ${allBut(conditions, "fs")}) AS in_stock`,
      `(SELECT jsonb_build_array(min(price), max(price)) FROM f
         WHERE price IS NOT NULL AND ${allBut(conditions, "fp")}) AS price`,
      ...(related ? [related.select] : [])
    )
  }
  const text = `WITH m AS MATERIALIZED (
      SELECT d.product_id, d.brand_id, d.brand_handle, d.brand_name, d.options, d.in_stock,
             d.categories, d.product_created_at AS created_at,
             (d.prices ->> ${priceKey})::numeric AS price, ${rank.score} AS score
        FROM search_document d ${rank.lateral}
       WHERE d.published ${scope}
    ), f AS MATERIALIZED (
      SELECT m.*${flags.map((flag) => `, ${flag}`).join("")}${ordAt} FROM m
    )${related?.cte ?? ""}
    SELECT ${selects.join(",\n")}`
  return sql.finish(text)
}

interface Row {
  count: number
  ids?: string[]
  brands?: [string, string, number][]
  options?: Record<string, number>
  in_stock?: number
  price?: [number | string | null, number | string | null]
  related?: ListingResult["related"]
  [own: `own${string}`]: Record<string, number> | undefined
}

const facetList = (counts: Record<string, number> | undefined): FacetCount[] =>
  Object.entries(counts ?? {}).map(([value, count]) => ({ value, count }))

/** The statement's one row read into the answer. */
export function listingResult(plan: ListingPlan, row: Row | undefined): ListingResult {
  const [min, max] = row?.price ?? [null, null]
  return {
    count: row?.count ?? 0,
    ids: row?.ids ?? [],
    brands: (row?.brands ?? []).map(([handle, name, count]) => ({
      handle,
      name,
      count,
    })),
    options: facetList(row?.options),
    ownOptions: Object.fromEntries(
      plan.filters.options.map((filter, at) => [filter.key, facetList(row?.[`own${String(at)}`])])
    ),
    inStock: row?.in_stock ?? 0,
    price: min === null || max === null ? null : { min: Number(min), max: Number(max) },
    related: row?.related ?? null,
  }
}
