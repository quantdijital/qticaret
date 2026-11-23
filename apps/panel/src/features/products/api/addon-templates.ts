import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { AddonInput, ProductAddon } from "@/features/products/api/addons"
import type { ProductCatalog } from "@/features/products/api/product-edit"

/**
 * Add-on templates (adr/0052 Ek 2026-11-23): add-ons defined once under
 * Settings > Product attributes and linked to products live, directly,
 * in bulk or through an attribute template. Editing one changes every
 * product it is linked to.
 */

export interface AddonTemplate {
  id: string
  name: string
  addons: ProductAddon[]
  /** Products linked to it directly. */
  product_count: number
  /** Attribute templates that carry it. */
  attribute_templates: { id: string; name: string }[]
}

/** How a product reaches a template: linked to it, or through its attribute template. */
export type AddonTemplateVia = "product" | "attribute_template"

/** A template as the product's catalog read names it. */
export interface ProductAddonTemplate {
  id: string
  name: string
  addons: ProductAddon[]
  via: AddonTemplateVia
}

const TEMPLATES_KEY = ["addon-templates"] as const

export const addonTemplatesQuery = () =>
  queryOptions({
    queryKey: TEMPLATES_KEY,
    queryFn: async () =>
      (
        await sdk.client.fetch<{ addon_templates: AddonTemplate[] }>("/admin/addon-templates", {
          query: { limit: 100 },
        })
      ).addon_templates,
  })

const templateUrl = (id: string) => `/admin/addon-templates/${encodeURIComponent(id)}`

// A template's change reaches every product that shows it
async function refresh(client: ReturnType<typeof useQueryClient>) {
  await client.invalidateQueries({ queryKey: TEMPLATES_KEY })
  await client.invalidateQueries({ queryKey: ["products", "catalog"] })
  await client.invalidateQueries({ queryKey: ["attribute-templates"] })
}

/** Creates (`id` null) or updates a template: its name and the whole list of add-ons. */
export function useSaveAddonTemplate() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string | null
      name: string
      addons: AddonInput[]
    }) =>
      (
        await sdk.client.fetch<{ addon_template: AddonTemplate }>(
          id ? templateUrl(id) : "/admin/addon-templates",
          { method: "POST", body }
        )
      ).addon_template,
    onSuccess: () => refresh(client),
  })
}

export function useDeleteAddonTemplate() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => sdk.client.fetch(templateUrl(id), { method: "DELETE" }),
    onSuccess: () => refresh(client),
  })
}

/** The templates linked to a product, the whole list; answers with its catalog fields. */
export function useLinkAddonTemplates(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (templateIds: string[]) =>
      sdk.client.fetch<ProductCatalog>(
        `/admin/products/${encodeURIComponent(productId)}/addon-templates`,
        { method: "POST", body: { template_ids: templateIds } }
      ),
    onSuccess: async (saved) => {
      client.setQueryData(["products", "catalog", productId], saved)
      await client.invalidateQueries({ queryKey: TEMPLATES_KEY })
    },
  })
}

/** The templates an attribute template carries, in order, the whole list. */
export const carryAddonTemplates = (attributeTemplateId: string, ids: string[]) =>
  sdk.client.fetch(
    `/admin/attribute-templates/${encodeURIComponent(attributeTemplateId)}/addon-templates`,
    { method: "POST", body: { addon_template_ids: ids } }
  )
