import { useQuery } from "@tanstack/react-query"
import type { AttributeTemplate } from "@/features/attributes/types"
import { addonTemplatesQuery } from "@/features/products/api/addon-templates"
import type { AddonTemplate, ProductAddonTemplate } from "@/features/products/api/addon-templates"
import { ADDON_LIMITS } from "@/features/products/api/addons"
import type { ProductAddon } from "@/features/products/api/addons"
import { productCatalogQuery } from "@/features/products/api/product-edit"

/** What a product's add-ons come to under another attribute template. */
export interface CarryOutcome {
  /** Add-ons past five, not shown to shoppers. */
  hidden: number
  /** A required add-on among them: the product would sell without it. */
  requiredHidden: boolean
}

/**
 * A product's add-ons merged as the server merges them (adr/0052 Ek
 * 2026-11-23): its own, then the attribute template's (in its order),
 * then the ones linked to it; a template or add-on reached twice once;
 * five shown. Pure.
 */
export function carryOutcome(sources: {
  own: readonly ProductAddon[]
  carried: readonly Pick<AddonTemplate, "id" | "addons">[]
  linked: readonly Pick<ProductAddonTemplate, "id" | "addons">[]
}): CarryOutcome {
  const templates = new Set<string>()
  const ids = new Set<string>()
  const all: ProductAddon[] = []
  const take = (addons: readonly ProductAddon[]) => {
    for (const addon of addons) {
      if (!ids.has(addon.id)) {
        ids.add(addon.id)
        all.push(addon)
      }
    }
  }
  take(sources.own)
  for (const template of [...sources.carried, ...sources.linked]) {
    if (!templates.has(template.id)) {
      templates.add(template.id)
      take(template.addons)
    }
  }
  const past = all.slice(ADDON_LIMITS.addons)
  return { hidden: past.length, requiredHidden: past.some((addon) => addon.required) }
}

/**
 * Before a product changes attribute template: whether the new one's
 * add-on templates would take it past five (warned, not blocked). Read
 * only while a different template is picked; null otherwise.
 */
export function useCarryCheck(
  productId: string,
  next: AttributeTemplate | null,
  changed: boolean
): CarryOutcome | null {
  const carriedIds = next?.addon_template_ids ?? []
  const active = changed && carriedIds.length > 0
  const catalog = useQuery({ ...productCatalogQuery(productId), enabled: active })
  const templates = useQuery({ ...addonTemplatesQuery(), enabled: active })
  if (!active || !catalog.data || !templates.data) {
    return null
  }
  const byId = new Map(templates.data.map((template) => [template.id, template]))
  const outcome = carryOutcome({
    own: catalog.data.addons,
    carried: carriedIds.flatMap((id) => {
      const template = byId.get(id)
      return template ? [template] : []
    }),
    linked: (catalog.data.addon_templates ?? []).filter((each) => each.via === "product"),
  })
  return outcome.hidden > 0 ? outcome : null
}
