import { model } from "@medusajs/framework/utils"

/**
 * A saved look (adr/0064, Ek 2026-11-17): a copy of the storefront's design
 * the shop keeps to come back to. `saved` ones carry the name the shop gave
 * (ten at most); `auto` ones are taken before the draft is replaced (a
 * ready-made or saved look applied, a revision restored, the draft
 * discarded), the latest five kept. The document holds no menu set: the
 * shop's menus are its own (adr/0064 §2). Never shown to shoppers.
 */
export const StorefrontDesign = model
  .define("storefront_design", {
    id: model.id({ prefix: "sfd" }).primaryKey(),
    kind: model.enum(["saved", "auto"]),
    /** The shop's name for it; null for an automatic one (the panel names it). */
    name: model.text().nullable(),
    /** `name` in Turkish lower case: one saved look per name. */
    name_key: model.text().nullable(),
    /** The design document (`lib/storefront/layout`), `settings.menus` null. */
    document: model.json(),
    /** sha256 of the design as `lib/storefront/designs/digest.ts` reads it. */
    digest: model.text(),
    /** What the list and its cards show (`lib/storefront/designs/summary.ts`). */
    summary: model.json(),
    /** The staff member who saved it (an automatic one: who replaced the draft). */
    created_by: model.text().nullable(),
    /** When it was last brought into the draft. */
    applied_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      on: ["name_key"],
      unique: true,
      where: "kind = 'saved' AND deleted_at IS NULL",
    },
    { on: ["digest"], where: "deleted_at IS NULL" },
  ])
