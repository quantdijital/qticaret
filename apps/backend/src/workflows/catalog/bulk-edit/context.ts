import type { IProductModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductTagsWorkflow } from "@medusajs/medusa/core-flows"
import { templateSourceOf } from "../../../lib/catalog/addons"
import { ValidationError } from "../../../lib/errors"
import { BRANDS_MODULE } from "../../../modules/brands"
import type BrandsModuleService from "../../../modules/brands/service"
import { requireAddonsFlag } from "../../addon-templates/usage"
import type { BulkChange } from "./change"
import type { PlanContext } from "./plan-result"

// The shop's tags a name search reads at most: an exact name is among the first
const TAG_LOOKUP = 50

const fold = (text: string) => text.trim().toLocaleLowerCase("tr")

/** The shop's tag with this name, letter case aside; null when it has none. */
async function tagNamed(container: MedusaContainer, value: string): Promise<string | null> {
  const service = container.resolve<IProductModuleService>(Modules.PRODUCT)
  // The exact name first: a search may hold more tags than it reads
  const [exact] = await service.listProductTags(
    { value: [value.trim()] },
    { take: 1, select: ["id", "value"] }
  )
  if (exact) {
    return exact.id
  }
  const tags = await service.listProductTags(
    { q: value.trim() },
    { take: TAG_LOOKUP, select: ["id", "value"] }
  )
  return tags.find((tag) => fold(tag.value) === fold(value))?.id ?? null
}

// A tag change's tag: found, made for `add` when the run is real, refused for `remove` when unknown
async function tagContext(
  container: MedusaContainer,
  change: Extract<BulkChange, { action: "tag" }>,
  write: boolean
): Promise<NonNullable<PlanContext["tag"]>> {
  const value = change.value.trim()
  const found = await tagNamed(container, value)
  if (found) {
    return { id: found, value }
  }
  if (change.mode === "remove") {
    throw new ValidationError("bulk_edit.tag_unknown", { field: "value" })
  }
  if (!write) {
    return { id: null, value }
  }
  const { result } = await createProductTagsWorkflow(container).run({
    input: { product_tags: [{ value }] },
  })
  return { id: result[0]?.id ?? null, value }
}

async function addonTemplatesContext(
  container: MedusaContainer,
  change: Extract<BulkChange, { action: "addon_template" }>
): Promise<PlanContext> {
  // Linking needs the shop's add-ons on: said once for the run, not per product
  if (change.mode === "add") {
    await requireAddonsFlag(container)
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "addon_template",
    fields: ["id", "name", "addons"],
  })
  const templates = new Map(
    (data as { id: string; name: string; addons?: unknown }[]).map((row) => [
      row.id,
      templateSourceOf(row),
    ])
  )
  if (!templates.has(change.template_id)) {
    throw new ValidationError("bulk_edit.addon_template_unknown", { field: "template_id" })
  }
  return { locationId: null, addonTemplates: templates }
}

/**
 * What a run needs of the shop before it plans a product: the change's
 * category, brand, tag or add-on template checked once (unknown: refused
 * for the whole run), the default warehouse for stock. `write` false (a
 * preview) makes nothing: a tag still to be made is planned by its name.
 */
export async function planContext(
  container: MedusaContainer,
  change: BulkChange,
  write: boolean
): Promise<PlanContext> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  switch (change.action) {
    case "category": {
      const { data } = await query.graph({
        entity: "product_category",
        fields: ["id"],
        filters: { id: change.category_id },
      })
      if (data.length === 0) {
        throw new ValidationError("bulk_edit.category_unknown", { field: "category_id" })
      }
      return { locationId: null }
    }
    case "brand": {
      if (change.brand_id) {
        const brands = await container
          .resolve<BrandsModuleService>(BRANDS_MODULE)
          .listBrands({ id: change.brand_id }, { take: 1, select: ["id"] })
        if (brands.length === 0) {
          throw new ValidationError("brands.unknown", { field: "brand_id" })
        }
      }
      return { locationId: null }
    }
    case "tag":
      return { locationId: null, tag: await tagContext(container, change, write) }
    case "sale":
      return { locationId: null, now: new Date() }
    case "addon_template":
      return addonTemplatesContext(container, change)
    case "stock": {
      const { data } = await query.graph({ entity: "store", fields: ["default_location_id"] })
      const locationId = (data[0] as { default_location_id?: string | null } | undefined)
        ?.default_location_id
      if (!locationId) {
        throw new ValidationError("bulk_edit.no_location")
      }
      return { locationId }
    }
    case "price":
    case "status":
    case "seo_template":
    case "alt_text":
    case "cost":
    case "backorder":
      return { locationId: null }
  }
}
