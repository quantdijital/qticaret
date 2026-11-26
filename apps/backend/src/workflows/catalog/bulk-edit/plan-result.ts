import type { AddonTemplateSource } from "../../../lib/catalog/addons"
import type { LevelAdjustment, LevelQuantity } from "../../stock/write-levels"
import type { SaleEntry } from "../../pricing/variant-sale/plan"
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
  /** Unit costs by variant, in lira as the catalog save takes them; null clears one. */
  | { action: "cost"; variants: Record<string, { cost: number | null }> }
  /**
   * One add-on template linked or unlinked: applied to the links as they are
   * when written, under the product's lock, so one made meanwhile is kept.
   */
  | { action: "addon_template"; mode: "add" | "remove"; template_id: string }
  | { action: "brand"; brand_id: string | null }
  /** The product's tags after the change, by id. */
  | { action: "tag"; tag_ids: string[] }
  | { action: "backorder"; variants: { id: string; allow_backorder: boolean }[] }
  /** Sales set and cleared, through the product page's own workflow (adr/0086). */
  | { action: "sale"; set: SaleEntry[]; clear: string[] }

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
  /** The shop's add-on templates, for an add-on template change (adr/0052 Ek 2026-11-23). */
  addonTemplates?: ReadonlyMap<string, AddonTemplateSource>
  /**
   * A tag change's tag: its id, or null when `add` makes it as the run
   * starts (a preview plans with null: every product would take it).
   */
  tag?: { id: string | null; value: string }
  /** When a sale's days are checked against (a sale already over is refused). */
  now?: Date
}

export const UNCHANGED: BulkPlan = { kind: "unchanged" }
export const skipped = (key: string): BulkPlan => ({ kind: "skipped", key })
export const writing = (write: BulkWrite, diff: BulkDiff): BulkPlan => ({
  kind: "write",
  write,
  diff,
})
