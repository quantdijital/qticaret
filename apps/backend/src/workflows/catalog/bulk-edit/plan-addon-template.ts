import { byTemplateName, storedAddonsOf, withinAddonLimit } from "../../../lib/catalog/addons"
import type { AddonTemplateSource } from "../../../lib/catalog/addons"
import { carriedIdsOf } from "../../addons/effective"
import type { BulkChange } from "./change"
import { UNCHANGED, skipped, writing } from "./plan-result"
import type { BulkPlan } from "./plan-result"
import type { BulkProduct } from "./products"

const sourcesOf = (ids: readonly string[], templates: ReadonlyMap<string, AddonTemplateSource>) =>
  ids.flatMap((id) => {
    const template = templates.get(id)
    return template ? [template] : []
  })

/**
 * An add-on template linked to or unlinked from one product (adr/0052 Ek
 * 2026-11-23). Linking one that would take the product past five add-ons
 * (its own, its attribute template's and its linked templates') leaves
 * it out. Pure: `templates` are the shop's, read once for the run.
 */
export function planAddonTemplate(
  product: BulkProduct,
  change: Extract<BulkChange, { action: "addon_template" }>,
  templates: ReadonlyMap<string, AddonTemplateSource>
): BulkPlan {
  const linked = (product.addon_templates ?? []).flatMap((each) => (each ? [each.id] : []))
  const has = linked.includes(change.template_id)
  if (change.mode === "remove") {
    if (!has) {
      return UNCHANGED
    }
    const after = linked.filter((id) => id !== change.template_id)
    return writing(
      { action: "addon_template", template_ids: after },
      { addon_templates: { before: linked, after } }
    )
  }
  if (has) {
    return UNCHANGED
  }
  const after = [...linked, change.template_id]
  const within = withinAddonLimit({
    own: storedAddonsOf(product.product_extension?.addons ?? null),
    carried: sourcesOf(carriedIdsOf(product.attribute_template?.addon_template_ids), templates),
    linked: sourcesOf(after, templates).sort(byTemplateName),
  })
  return within
    ? writing(
        { action: "addon_template", template_ids: after },
        { addon_templates: { before: linked, after } }
      )
    : skipped("addons.too_many")
}
