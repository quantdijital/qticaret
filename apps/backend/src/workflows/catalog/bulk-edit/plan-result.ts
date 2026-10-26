import type { LevelAdjustment, LevelQuantity } from "../../stock/write-levels"
import type { nextPrices } from "../prices"

/**
 * What planning one product gives (F3.10): the writes and their
 * before/after values (the audit entry's `diff`, as the product routes
 * record theirs), nothing (it is so already), or why it is left out.
 */

export type BulkWrite =
  | { action: "price"; variants: { id: string; prices: ReturnType<typeof nextPrices> }[] }
  | {
      action: "stock"
      create: LevelQuantity[]
      update: LevelQuantity[]
      /** By how much a level moves, written under the item's lock (add or remove). */
      adjust: LevelAdjustment[]
    }
  | { action: "status"; status: "published" | "draft" }
  | {
      action: "category"
      /** The product's categories after the change; undefined when they stay. */
      category_ids?: string[]
      /** The primary category after the change; undefined when it stays. */
      primary_category_id?: string | null
    }
  | { action: "seo_template"; values: { seo_title?: null; seo_description?: null } }
  | { action: "alt_text"; alts: { id: string; alt: string }[] }

/** A field's value before and after, by a key naming it (`variant:<id>:price:try`). */
export type BulkDiff = Record<string, { before: unknown; after: unknown }>

export type BulkPlan =
  | { kind: "write"; write: BulkWrite; diff: BulkDiff }
  | { kind: "unchanged" }
  /** Left out, with the server message key that says why. */
  | { kind: "skipped"; key: string }

export interface PlanContext {
  /** The shop's default warehouse, where stock changes. */
  locationId: string | null
}

export const UNCHANGED: BulkPlan = { kind: "unchanged" }
export const skipped = (key: string): BulkPlan => ({ kind: "skipped", key })
export const writing = (write: BulkWrite, diff: BulkDiff): BulkPlan => ({
  kind: "write",
  write,
  diff,
})
