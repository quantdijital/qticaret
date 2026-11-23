import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import { carryAddonTemplates } from "@/features/products/api/addon-templates"
import { carriedChanged, templateBody } from "./form"
import type { TemplateForm } from "./form"
import type { AttributeTemplate, AttributeValue, ProductAttributes } from "./types"

const TEMPLATES_KEY = ["attribute-templates"] as const

export const templatesQuery = () =>
  queryOptions({
    queryKey: TEMPLATES_KEY,
    queryFn: async () =>
      (
        await sdk.client.fetch<{ attribute_templates: AttributeTemplate[]; count: number }>(
          "/admin/attribute-templates",
          { query: { limit: 100 } }
        )
      ).attribute_templates,
  })

/**
 * Creates (`template` null) or updates a template. Removing attributes
 * products have values for needs `confirm`: the page asks before it sends
 * (adr/0013).
 */
export function useSaveTemplate() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      template,
      form,
      confirm,
    }: {
      template: AttributeTemplate | null
      form: TemplateForm
      confirm: boolean
    }) => {
      const id = template?.id ?? null
      const body = templateBody(form, template)
      const { attribute_template: saved } = await sdk.client.fetch<{
        attribute_template: AttributeTemplate
      }>(
        id ? `/admin/attribute-templates/${encodeURIComponent(id)}` : "/admin/attribute-templates",
        {
          method: "POST",
          body: id
            ? { ...body, ...(confirm ? { confirm_delete_values: true } : {}) }
            : { ...body, handle: form.handle.trim() },
        }
      )
      // adr/0052 Ek 2026-11-23: the carried add-on templates, after the template exists
      if (carriedChanged(template, form)) {
        await carryAddonTemplates(saved.id, form.addonTemplateIds)
      }
      return saved
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: TEMPLATES_KEY })
      await client.invalidateQueries({ queryKey: ["addon-templates"] })
      await client.invalidateQueries({ queryKey: ["products", "catalog"] })
      await client.invalidateQueries({ queryKey: ["products", "attributes"] })
    },
  })
}

export function useDeleteTemplate() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/attribute-templates/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: TEMPLATES_KEY })
    },
  })
}

const attributesUrl = (productId: string) =>
  `/admin/products/${encodeURIComponent(productId)}/attributes`

export const productAttributesQuery = (productId: string) =>
  queryOptions({
    queryKey: ["products", "attributes", productId],
    queryFn: () => sdk.client.fetch<ProductAttributes>(attributesUrl(productId)),
  })

export function useSaveProductAttributes(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      template_id: string | null
      values?: Record<string, AttributeValue>
      confirm_template_change?: boolean
    }) => sdk.client.fetch<ProductAttributes>(attributesUrl(productId), { method: "POST", body }),
    onSuccess: (saved) => {
      client.setQueryData(["products", "attributes", productId], saved)
    },
  })
}
