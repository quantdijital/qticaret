import { sdk } from "@/lib/sdk"
import type { SheetJob } from "@/features/products/api/sheets"
import type { ProductListParams } from "@/features/products/api/products"

/** Bulk edit (F3.10): one change to the products picked, run as a job on the server. */

/** Products one run takes; the server refuses more. */
export const MAX_BULK_PRODUCTS = 1000

export type BulkAction =
  "price" | "stock" | "status" | "category" | "seo_template" | "alt_text" | "cost"

/** The change as the job takes it (`catalog.bulk_edit`). */
export type BulkChange =
  | { action: "price"; mode: "set" | "percent" | "amount"; value: number }
  | { action: "stock"; mode: "set" | "adjust"; value: number }
  | { action: "status"; status: "published" | "draft" }
  | { action: "category"; mode: "add" | "remove" | "primary"; category_id: string }
  | { action: "seo_template"; fields: ("seo_title" | "seo_description")[] }
  | { action: "alt_text" }
  /** F11.4: the variants' unit cost in lira, VAT excluded; `percent` leaves one without a cost. */
  | { action: "cost"; mode: "set" | "percent" | "clear"; value?: number }

export interface BulkSummary {
  action: BulkAction
  products: number
  changed: number
  unchanged: number
  skipped: number
  failed: number
}

export const startBulkEdit = async (productIds: string[], change: BulkChange) =>
  (
    await sdk.client.fetch<{ async_job: SheetJob }>("/admin/async-jobs", {
      method: "POST",
      body: { type: "catalog.bulk_edit", input: { product_ids: productIds, change } },
    })
  ).async_job

/**
 * Every product the list's search and view hold, for "select all": their
 * ids and how many there are. Past the limit the ids are not read at all.
 */
export async function matchingProductIds({
  q,
  status,
}: Omit<ProductListParams, "page">): Promise<{ ids: string[]; count: number }> {
  const filters = {
    ...(q ? { q } : {}),
    ...(status === "all" ? {} : { status: [status] }),
  }
  const { count } = await sdk.admin.product.list({ fields: "id", limit: 1, ...filters })
  if (count > MAX_BULK_PRODUCTS) {
    return { ids: [], count }
  }
  const { products } = await sdk.admin.product.list({
    fields: "id",
    limit: MAX_BULK_PRODUCTS,
    order: "-updated_at",
    ...filters,
  })
  return { ids: products.map((product) => product.id), count }
}
