import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { chunksOf } from "../../../lib/catalog"
import { categoryAndBelow } from "../../../lib/catalog/product-board"
import { ValidationError } from "../../../lib/errors"
import type { BulkEditInput, BulkScope } from "./change"

/**
 * The products a bulk run goes through (F3.10; 2026-11-23): the ones the
 * panel named, or a scope the server reads itself — the whole catalogue
 * or a category with those below it — a page at a time, so a run has no
 * cap on how many it takes but never holds more than a page of ids.
 */

/** Product ids read per query of a scope. */
export const SCOPE_PAGE = 200

/** A scope's row: its id, and whether it sells gift cards (left out). */
export interface ScopeRow {
  id: string
  product_extension?: { is_gift_card?: boolean | null } | null
}

/** One page after `after` (by id, ascending), at most `take` rows. */
export type ReadScopePage = (after: string | null, take: number) => Promise<ScopeRow[]>

/** What Medusa's product query filters for a scope; the categories are the one and those below. */
export function scopeFilters(
  scope: BulkScope,
  categories: readonly { id: string; parent_category_id?: string | null }[]
): Record<string, unknown> {
  if (scope.kind === "all") {
    return {}
  }
  return { categories: { id: categoryAndBelow(scope.category_id, categories) } }
}

/**
 * A scope's product ids, page by page by id (a keyset, so a product made
 * or deleted meanwhile moves no other), in chunks of `size`. A gift card
 * product is left out: it takes no add-ons. Stops at a short page.
 */
export async function* scopeChunks(
  read: ReadScopePage,
  size: number,
  take: number = SCOPE_PAGE
): AsyncGenerator<string[]> {
  let after: string | null = null
  let pending: string[] = []
  for (;;) {
    const rows = await read(after, take)
    for (const row of rows) {
      if (row.product_extension?.is_gift_card !== true) {
        pending.push(row.id)
      }
    }
    while (pending.length >= size) {
      yield pending.slice(0, size)
      pending = pending.slice(size)
    }
    const last = rows.at(-1)
    if (rows.length < take || !last) {
      break
    }
    after = last.id
  }
  if (pending.length > 0) {
    yield pending
  }
}

/** The ids a run goes through, in chunks, and about how many (for its progress). */
export interface RunProducts {
  total: number
  chunks: AsyncIterable<string[]> | Iterable<string[]>
}

/** The products named, or those of the scope; a category that is gone is refused. */
export async function runProducts(
  container: MedusaContainer,
  input: BulkEditInput,
  size: number
): Promise<RunProducts> {
  if (!input.scope) {
    const ids = input.product_ids ?? []
    return { total: ids.length, chunks: chunksOf(ids, size) }
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const scope = input.scope
  let categories: { id: string; parent_category_id?: string | null }[] = []
  if (scope.kind === "category") {
    const { data } = await query.graph({
      entity: "product_category",
      fields: ["id", "parent_category_id"],
    })
    categories = data as typeof categories
    if (!categories.some((category) => category.id === scope.category_id)) {
      throw new ValidationError("bulk_edit.category_unknown", { field: "category_id" })
    }
  }
  const filters = scopeFilters(scope, categories)
  const { metadata } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters,
    pagination: { skip: 0, take: 1 },
  })
  const read: ReadScopePage = async (after, take) => {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "product_extension.is_gift_card"],
      filters: after === null ? filters : { ...filters, id: { $gt: after } },
      pagination: { skip: 0, take, order: { id: "ASC" } },
    })
    return data as ScopeRow[]
  }
  return { total: metadata?.count ?? 0, chunks: scopeChunks(read, size) }
}
