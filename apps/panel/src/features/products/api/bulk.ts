import { sdk } from "@/lib/sdk"
import type { SheetJob } from "@/features/products/api/sheets"
import { productBoard } from "@/features/products/api/products"
import type { ProductFilters } from "@/features/products/api/products"

/** Bulk edit (F3.10): one change to the products picked, run as a job on the server. */

/** Products one run takes; the server refuses more. */
export const MAX_BULK_PRODUCTS = 1000

export type BulkAction =
  | "price"
  | "stock"
  | "status"
  | "category"
  | "seo_template"
  | "alt_text"
  | "cost"
  | "addon_template"
  | "sale"
  | "brand"
  | "tag"
  | "backorder"

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
  /** adr/0052 Ek 2026-11-23: an add-on template linked to or unlinked from each product. */
  | { action: "addon_template"; mode: "add" | "remove"; template_id: string }
  /**
   * adr/0086: each variant's sale price, a share (`percent`) or an amount
   * off its own regular price worked out on the server, or the sales cleared.
   */
  | {
      action: "sale"
      mode: "percent" | "amount" | "clear"
      value?: number
      starts_at?: string | null
      ends_at?: string | null
    }
  /** The brand set, or taken off with null. */
  | { action: "brand"; brand_id: string | null }
  /** A tag by its name; `add` makes it when the shop has none. */
  | { action: "tag"; mode: "add" | "remove"; value: string }
  /** Selling past stock, for the variants whose stock is tracked. */
  | { action: "backorder"; allow: boolean }

/** A product left out or failed, with why (the server's Turkish). */
export interface BulkProblem {
  handle: string
  title: string | null
  message: string
}

export interface BulkSummary {
  action: BulkAction
  products: number
  changed: number
  unchanged: number
  skipped: number
  failed: number
  /** The first products left out or failed (the report has every one). */
  problems?: BulkProblem[]
}

/** What a change would do before it is applied: nothing written. */
export interface BulkPreview {
  products: number
  changed: number
  unchanged: number
  skipped: number
  problems: BulkProblem[]
}

/** `POST /admin/catalog/bulk-edit/preview`: the products planned as the job would, none written. */
export const previewBulkEdit = async (productIds: string[], change: BulkChange) =>
  (
    await sdk.client.fetch<{ preview: BulkPreview }>("/admin/catalog/bulk-edit/preview", {
      method: "POST",
      body: { product_ids: productIds, change },
    })
  ).preview

export const startBulkEdit = async (productIds: string[], change: BulkChange) =>
  (
    await sdk.client.fetch<{ async_job: SheetJob }>("/admin/async-jobs", {
      method: "POST",
      body: { type: "catalog.bulk_edit", input: { product_ids: productIds, change } },
    })
  ).async_job

/**
 * Products the server finds itself, for an add-on template (2026-11-23):
 * the whole catalogue or a category with those below it, with no cap.
 */
export type BulkScope = { kind: "all" } | { kind: "category"; category_id: string }

export const startScopedBulkEdit = async (
  scope: BulkScope,
  change: Extract<BulkChange, { action: "addon_template" }>
) =>
  (
    await sdk.client.fetch<{ async_job: SheetJob }>("/admin/async-jobs", {
      method: "POST",
      body: { type: "catalog.bulk_edit", input: { scope, change } },
    })
  ).async_job

/**
 * Every product the list's search, view and filters hold, for "select
 * all": their ids and how many there are. Past the limit no id is taken.
 */
export async function matchingProductIds(
  filters: ProductFilters
): Promise<{ ids: string[]; count: number }> {
  const { ids, count } = await productBoard(filters, 0, MAX_BULK_PRODUCTS)
  return { ids: count > MAX_BULK_PRODUCTS ? [] : ids, count }
}
