import { Statement } from "./statement"

/**
 * How many products each category lists, counted in one statement
 * (adr/0049 Ek 2026-11-14 §10 karar 7b): for every category, its products
 * in any category of its shown subtree (worked out by the caller, as a
 * listing's scope is), published and, when channels are given, in one of
 * them; with `inStockOnly`, only those in stock (T1). The rows a category's listing counts, so the number a tile shows
 * is the one its page shows. A category with none is 0.
 */
export function categoryCountsStatement(
  subtrees: readonly { id: string; ids: readonly string[] }[],
  channels: readonly string[] | null,
  inStockOnly = false
): { sql: string; params: unknown[] } {
  const sql = new Statement()
  const tree = sql.param(JSON.stringify(subtrees))
  const inChannels = channels ? ` AND d.sales_channel_ids && ${sql.textArray(channels)}` : ""
  // T1: the shop hides sold-out products, so its tiles count what its listings show
  const inStock = inStockOnly ? " AND d.in_stock" : ""
  return sql.finish(
    `SELECT s.id, count(d.product_id)::integer AS count
       FROM jsonb_to_recordset(${tree}::jsonb) AS s(id text, ids jsonb)
       LEFT JOIN search_document d
         ON d.published${inStock}
        AND d.category_ids && ARRAY(SELECT jsonb_array_elements_text(s.ids))${inChannels}
      GROUP BY s.id`
  )
}

/** The statement's rows by category id. */
export const categoryCountsOf = (
  rows: readonly { id: string; count: number | string }[]
): Record<string, number> => Object.fromEntries(rows.map((row) => [row.id, Number(row.count)]))
