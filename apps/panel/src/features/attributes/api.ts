import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import { definitionsApi } from "./form"
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

const orNull = (text: string) => (text.trim() === "" ? null : text.trim())

/**
 * Creates or updates a template. Removing attributes products have values
 * for needs `confirm`: the page asks before it sends (adr/0013).
 */
export function useSaveTemplate() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      form,
      confirm,
    }: {
      id: string | null
      form: TemplateForm
      confirm: boolean
    }) => {
      const body = {
        name: form.name.trim(),
        description: orNull(form.description),
        definitions: definitionsApi(form.definitions),
      }
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
      return saved
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: TEMPLATES_KEY })
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
