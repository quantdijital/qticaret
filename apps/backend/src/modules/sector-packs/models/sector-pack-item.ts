import { model } from "@medusajs/framework/utils"

export const PACK_ITEM_KINDS = [
  "attribute_template",
  "attribute",
  "category",
  "flag",
  "seo_template",
  // adr/0063 §4: what a storefront preset makes in the shop (an image it uploads, a demo record)
  "preset_image",
  "demo_record",
  // adr/0076 §12: a content page made as a draft, a catalog default set in the settings
  "page",
  "setting",
] as const
export type PackItemKind = (typeof PACK_ITEM_KINDS)[number]

/**
 * What became of the item when it was offered: `added` (the pack made it),
 * `kept` (the shop had its own, left as it was) or `skipped` (nothing to
 * hang it on: its template or parent category is gone).
 */
export const PACK_ITEM_OUTCOMES = ["added", "kept", "skipped"] as const
export type PackItemOutcome = (typeof PACK_ITEM_OUTCOMES)[number]

/**
 * One item of a sector pack, offered to this shop once (adr/0061 C12): an
 * attribute template, one of its attributes, a category, a flag preset or
 * an SEO template, by the stable name the pack gives it (`packItemKey`).
 * A re-apply, of this version or a newer one, never offers a recorded
 * item again: what the shop edited or deleted since stays so.
 */
export const SectorPackItem = model
  .define("sector_pack_item", {
    id: model.id({ prefix: "spitm" }).primaryKey(),
    pack: model.text(),
    key: model.text(),
    kind: model.enum([...PACK_ITEM_KINDS]),
    outcome: model.enum([...PACK_ITEM_OUTCOMES]),
    /** The pack's version that first offered it. */
    version: model.number(),
    /**
     * The record it is (a template, definition, category or media id); none
     * for a setting. A preset's image uploaded again, its first gone, names the new one.
     */
    record_id: model.text().nullable(),
  })
  .indexes([{ on: ["pack", "key"], unique: true, where: "deleted_at IS NULL" }])
