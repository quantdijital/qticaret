import { model } from "@medusajs/framework/utils"

/**
 * Add-ons defined once and shared (adr/0052 Ek 2026-11-23): "Engraving,
 * +150 TL" kept here and linked to products (directly, by bulk edit, or
 * through an attribute template that carries it). A product reads the
 * template's add-ons live: editing them here changes every linked
 * product. `addons` holds the same `{ items }` a product's own add-ons
 * hold (`lib/catalog/addons`).
 */
export const AddonTemplate = model.define("addon_template", {
  id: model.id({ prefix: "adtpl" }).primaryKey(),
  name: model.text(),
  addons: model.json().nullable(),
})
