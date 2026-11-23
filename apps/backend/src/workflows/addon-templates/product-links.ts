import { MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { byTemplateName, growsPastLimit } from "../../lib/catalog/addons"
import { ValidationError } from "../../lib/errors"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import { addonSourcesAmong, addonTemplatesByIds } from "../addons/effective"
import { requireAddonsFlag } from "./usage"

/**
 * The add-on templates linked to a product after the write: the whole
 * list (the product page), or one template added or removed (bulk edit),
 * applied to the links as they are under the product's lock, so a link
 * made meanwhile is kept.
 */
export type SetProductAddonTemplatesInput = { product_id: string } & (
  { template_ids: string[] } | { add: string } | { remove: string }
)

/** The templates linked after the change, from those linked now. Pure. */
export function nextLinkedIds(
  before: readonly string[],
  input: SetProductAddonTemplatesInput
): string[] {
  if ("template_ids" in input) {
    return [...input.template_ids]
  }
  if ("add" in input) {
    return before.includes(input.add) ? [...before] : [...before, input.add]
  }
  return before.filter((id) => id !== input.remove)
}

/** Templates a write may link: they take the template's lock, so a delete waits or is waited for. */
export function templatesLinkedBy(input: SetProductAddonTemplatesInput): string[] {
  const ids = "template_ids" in input ? input.template_ids : "add" in input ? [input.add] : []
  return [...new Set(ids)].sort()
}

type LinkDefinition = Record<string, Record<string, string>>

export interface ProductLinksPlan {
  create: LinkDefinition[]
  dismiss: LinkDefinition[]
  /** Linked before and after, for the audit entry. */
  before: string[]
  after: string[]
}

const linkOf = (productId: string, templateId: string): LinkDefinition => ({
  [Modules.PRODUCT]: { product_id: productId },
  [PRODUCT_ATTRIBUTES_MODULE]: { addon_template_id: templateId },
})

/**
 * What linking add-on templates to a product changes (adr/0052 Ek
 * 2026-11-23): links to make and to dismiss. A template unknown (or
 * deleted meanwhile) is refused; linking one needs the shop's flag and
 * may not grow the product past five add-ons with its own and its
 * attribute template's. Unlinking is always allowed.
 */
export const planProductAddonTemplatesStep = createStep(
  "addon-templates-plan-product-links",
  async (input: SetProductAddonTemplatesInput, { container }) => {
    const sources = (await addonSourcesAmong(container, [input.product_id])).get(input.product_id)
    if (!sources) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
    }
    const before = sources.linked.map((template) => template.id)
    const after = nextLinkedIds(before, input)
    const added = after.filter((id) => !before.includes(id))
    if (added.length > 0) {
      await requireAddonsFlag(container)
      const templates = await addonTemplatesByIds(container, after)
      if (templates.size !== new Set(after).size) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "addon_templates.unknown")
      }
      const linked = [...templates.values()].sort(byTemplateName)
      if (growsPastLimit(sources, { ...sources, linked })) {
        throw new ValidationError("addons.too_many", { field: "template_ids" })
      }
    }
    const plan: ProductLinksPlan = {
      create: added.map((id) => linkOf(input.product_id, id)),
      dismiss: before.filter((id) => !after.includes(id)).map((id) => linkOf(input.product_id, id)),
      before,
      after,
    }
    return new StepResponse(plan)
  }
)
