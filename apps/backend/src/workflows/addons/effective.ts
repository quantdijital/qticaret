import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  byTemplateName,
  effectiveAddons,
  storedAddonsOf,
  templateSourceOf,
} from "../../lib/catalog/addons"
import type {
  AddonSources,
  AddonTemplateSource,
  EffectiveAddons,
  StoredAddon,
} from "../../lib/catalog/addons"
import { chunksOf } from "../../lib/catalog"

type Container = Pick<MedusaContainer, "resolve">

interface ProductRow {
  id: string
  product_extension?: { addons?: unknown } | null
  addon_templates?: ({ id: string; name: string; addons?: unknown } | null)[] | null
  attribute_template?: { id: string; addon_template_ids?: unknown } | null
}

interface TemplateRow {
  id: string
  name: string
  addons?: unknown
}

// Products read per query: a page of cards, a cart, a bulk edit's chunk
const PRODUCT_CHUNK = 100

/** The ids an attribute template's column lists (adr/0052 Ek 2026-11-23); anything else is none. */
export const carriedIdsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string" && id !== "")
    : []

/** These add-on templates as sources, by id; ones gone are left out. */
export async function addonTemplatesByIds(
  container: Container,
  ids: readonly string[]
): Promise<Map<string, AddonTemplateSource>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) {
    return new Map()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "addon_template",
    fields: ["id", "name", "addons"],
    filters: { id: unique },
  })
  return new Map((data as TemplateRow[]).map((row) => [row.id, templateSourceOf(row)]))
}

/**
 * What each product's add-ons are made of (adr/0052 Ek 2026-11-23): its
 * own, the templates its attribute template carries and the templates
 * linked to it, as they are now. Products gone are left out.
 */
export async function addonSourcesAmong(
  container: Container,
  productIds: readonly (string | null | undefined)[]
): Promise<Map<string, AddonSources>> {
  const ids = [...new Set(productIds.filter((id): id is string => Boolean(id)))]
  const rows: ProductRow[] = []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  for (const chunk of chunksOf(ids, PRODUCT_CHUNK)) {
    const { data } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "product_extension.addons",
        "addon_templates.id",
        "addon_templates.name",
        "addon_templates.addons",
        "attribute_template.id",
        "attribute_template.addon_template_ids",
      ],
      filters: { id: chunk },
    })
    rows.push(...(data as ProductRow[]))
  }
  const carried = await addonTemplatesByIds(
    container,
    rows.flatMap((row) => carriedIdsOf(row.attribute_template?.addon_template_ids))
  )
  return new Map(
    rows.map((row) => [
      row.id,
      {
        own: storedAddonsOf(row.product_extension?.addons ?? null),
        carried: carriedIdsOf(row.attribute_template?.addon_template_ids).flatMap((id) => {
          const template = carried.get(id)
          return template ? [template] : []
        }),
        linked: (row.addon_templates ?? [])
          .flatMap((template) => (template ? [templateSourceOf(template)] : []))
          .sort(byTemplateName),
      },
    ])
  )
}

/** Each product's effective add-ons, merged, with the templates in play. */
export async function effectiveAddonsAmong(
  container: Container,
  productIds: readonly (string | null | undefined)[]
): Promise<Map<string, EffectiveAddons>> {
  const sources = await addonSourcesAmong(container, productIds)
  return new Map([...sources].map(([id, each]) => [id, effectiveAddons(each)]))
}

/** The add-ons a shopper picks from and the cart prices, by product (one without any is left out). */
export async function productAddonsAmong(
  container: Container,
  productIds: readonly (string | null | undefined)[]
): Promise<Map<string, StoredAddon[]>> {
  const effective = await effectiveAddonsAmong(container, productIds)
  return new Map(
    [...effective].flatMap(([id, merged]) =>
      merged.addons.length > 0 ? [[id, merged.addons] as const] : []
    )
  )
}
