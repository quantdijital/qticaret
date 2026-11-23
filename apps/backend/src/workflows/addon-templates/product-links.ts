import { MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import { addonSourcesAmong, addonTemplatesByIds } from "../addons/effective"
import { byTemplateName, withinAddonLimit } from "../../lib/catalog/addons"
import { ValidationError } from "../../lib/errors"
import { requireAddonsFlag } from "./usage"

export interface SetProductAddonTemplatesInput {
  product_id: string
  /** The add-on templates linked to the product after the write; the rest are unlinked. */
  template_ids: string[]
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
 * What linking these add-on templates to a product changes (adr/0052 Ek
 * 2026-11-23): links to make and to dismiss. A template unknown is
 * refused; linking one needs the shop's flag and keeps the product within
 * five add-ons with its own and its attribute template's. Unlinking is
 * always allowed.
 */
export const planProductAddonTemplatesStep = createStep(
  "addon-templates-plan-product-links",
  async (input: SetProductAddonTemplatesInput, { container }) => {
    const sources = (await addonSourcesAmong(container, [input.product_id])).get(input.product_id)
    if (!sources) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
    }
    const before = sources.linked.map((template) => template.id)
    const added = input.template_ids.filter((id) => !before.includes(id))
    if (added.length > 0) {
      await requireAddonsFlag(container)
      const templates = await addonTemplatesByIds(container, input.template_ids)
      if (templates.size !== input.template_ids.length) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "addon_templates.unknown")
      }
      const linked = [...templates.values()].sort(byTemplateName)
      if (!withinAddonLimit({ ...sources, linked })) {
        throw new ValidationError("addons.too_many", { field: "template_ids" })
      }
    }
    const plan: ProductLinksPlan = {
      create: added.map((id) => linkOf(input.product_id, id)),
      dismiss: before
        .filter((id) => !input.template_ids.includes(id))
        .map((id) => linkOf(input.product_id, id)),
      before,
      after: input.template_ids,
    }
    return new StepResponse(plan)
  }
)
