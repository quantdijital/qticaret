import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { growsPastLimit } from "../../lib/catalog/addons"
import type { AddonSources, AddonTemplateSource } from "../../lib/catalog/addons"
import { ValidationError } from "../../lib/errors"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { PRODUCT_ADDONS } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { addonSourcesAmong, carriedIdsOf } from "../addons/effective"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The product ↔ add-on template link's entry point (`links/product-addon-template.ts`:
 * Medusa names it `<product alias>_<addon template alias>`). Named, not imported: a
 * link definition evaluated before its modules load (a spec importing a workflow)
 * finds their linkables undefined.
 */
export const PRODUCT_ADDON_TEMPLATE_LINK = "product_addon_template"

/**
 * Who uses an add-on template (adr/0052 Ek 2026-11-23), and whether a
 * change keeps every product using it within five add-ons.
 */

export interface AddonTemplateUsage {
  /** Products linked to it directly. */
  product_ids: string[]
  /** Attribute templates that carry it. */
  attribute_template_ids: string[]
  /** Products that follow one of those attribute templates. */
  carried_product_ids: string[]
}

/** Writing add-ons into a template or linking one needs the shop's flag; unlinking never does. */
export async function requireAddonsFlag(container: Container): Promise<void> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  if (!(await settings.isFeatureEnabled(PRODUCT_ADDONS))) {
    throw new ValidationError("catalog.addons_disabled", { field: "addons" })
  }
}

/** Products that follow these attribute templates. */
export async function productsOfAttributeTemplates(
  container: Container,
  attributeTemplateIds: readonly string[]
): Promise<string[]> {
  if (attributeTemplateIds.length === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "attribute_template",
    fields: ["id", "products.id"],
    filters: { id: [...attributeTemplateIds] },
  })
  return [
    ...new Set(
      (data as { products?: ({ id: string } | null)[] | null }[]).flatMap((row) =>
        (row.products ?? []).flatMap((product) => (product ? [product.id] : []))
      )
    ),
  ]
}

/** Every attribute template with the add-on templates it carries. */
export async function attributeTemplateCarries(
  container: Container
): Promise<{ id: string; addon_template_ids: string[] }[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "attribute_template",
    fields: ["id", "addon_template_ids"],
  })
  return (data as { id: string; addon_template_ids?: unknown }[]).map((row) => ({
    id: row.id,
    addon_template_ids: carriedIdsOf(row.addon_template_ids),
  }))
}

/** The product links to these add-on templates, as the link table holds them. */
export async function productLinksOf(
  container: Container,
  templateIds: readonly string[]
): Promise<{ product_id: string; addon_template_id: string }[]> {
  if (templateIds.length === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: PRODUCT_ADDON_TEMPLATE_LINK,
    fields: ["product_id", "addon_template_id"],
    filters: { addon_template_id: [...templateIds] },
  })
  // Typed by Medusa's generated link types where they exist, `any` where not: read through unknown
  return data as unknown[] as { product_id: string; addon_template_id: string }[]
}

export async function addonTemplateUsage(
  container: Container,
  templateId: string
): Promise<AddonTemplateUsage> {
  const links = await productLinksOf(container, [templateId])
  const carriers = (await attributeTemplateCarries(container))
    .filter((row) => row.addon_template_ids.includes(templateId))
    .map((row) => row.id)
  return {
    product_ids: [...new Set(links.map((link) => link.product_id))],
    attribute_template_ids: carriers,
    carried_product_ids: await productsOfAttributeTemplates(container, carriers),
  }
}

/**
 * Refuses a change that would take any of these products past five
 * add-ons, counted merged before and after: `change` gives each
 * product's sources as they would be.
 */
export async function checkAddonLimit(
  container: Container,
  productIds: readonly string[],
  change: (sources: AddonSources, productId: string) => AddonSources,
  key: string
): Promise<void> {
  const sources = await addonSourcesAmong(container, productIds)
  for (const [productId, each] of sources) {
    if (growsPastLimit(each, change(each, productId))) {
      throw new ValidationError(key, { field: "addons" })
    }
  }
}

/** A product's sources with one template's add-ons as they will be. */
export const withTemplate =
  (template: AddonTemplateSource) =>
  (sources: AddonSources): AddonSources => {
    const swap = (list: readonly AddonTemplateSource[]) =>
      list.map((each) => (each.id === template.id ? template : each))
    return { ...sources, carried: swap(sources.carried), linked: swap(sources.linked) }
  }
