import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { storedAddonsOf } from "../../../lib/catalog/addons"
import { attributeTemplateCarries, productLinksOf } from "../../../workflows/addon-templates/usage"

interface TemplateRow {
  id: string
  name: string
  addons?: unknown
  created_at?: unknown
  updated_at?: unknown
}

/**
 * Add-on templates as the panel lists them (adr/0052 Ek 2026-11-23):
 * their add-ons, how many products are linked directly, and the
 * attribute templates that carry them.
 */
export async function readAddonTemplates(
  scope: MedusaContainer,
  filters: { id?: string } = {},
  page: { skip: number; take: number } = { skip: 0, take: 100 }
) {
  const { data, metadata } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "addon_template",
    fields: ["id", "name", "addons", "created_at", "updated_at"],
    filters,
    pagination: { skip: page.skip, take: page.take, order: { name: "ASC" } },
  })
  const rows = data as TemplateRow[]
  const ids = rows.map((row) => row.id)
  const links = await productLinksOf(scope, ids)
  const carriers = await attributeTemplateCarries(scope)
  const { data: attributeTemplates } =
    carriers.length > 0
      ? await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "attribute_template",
          fields: ["id", "name"],
          filters: { id: carriers.map((row) => row.id) },
        })
      : { data: [] }
  const names = new Map(
    (attributeTemplates as { id: string; name: string }[]).map((row) => [row.id, row.name])
  )
  const templates = rows.map((row) => ({
    id: row.id,
    name: row.name,
    addons: storedAddonsOf(row.addons ?? null),
    product_count: links.filter((link) => link.addon_template_id === row.id).length,
    attribute_templates: carriers
      .filter((carrier) => carrier.addon_template_ids.includes(row.id))
      .map((carrier) => ({ id: carrier.id, name: names.get(carrier.id) ?? "" })),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))
  return { templates, count: metadata?.count ?? templates.length }
}

export async function readAddonTemplate(scope: MedusaContainer, id: string) {
  const { templates } = await readAddonTemplates(scope, { id })
  const [template] = templates
  if (!template) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "addon_templates.unknown")
  }
  return template
}
