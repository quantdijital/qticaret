import { toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import type { AttributeTemplate, AttributeValue, ProductAttributes } from "../../lib/attributes"
import { errorText } from "../../lib/errors"
import { sdk } from "../../lib/sdk"

export interface ProductAttributesForm {
  template_id: string | null
  values: Record<string, AttributeValue>
  /** Set once the user agreed to drop the old template's values. */
  confirm_template_change?: boolean
}

/** The product's attributes, the templates to choose from, and the save. */
export function useProductAttributes(
  productId: string,
  onSaved: (saved: ProductAttributes) => void
) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const key = ["qticaret", "product-attributes", productId]
  const attributes = useQuery({
    queryKey: key,
    queryFn: () =>
      sdk.client.fetch<ProductAttributes>(
        `/admin/products/${encodeURIComponent(productId)}/attributes`
      ),
  })
  const templates = useQuery({
    queryKey: ["qticaret", "attribute-templates"],
    queryFn: () =>
      sdk.client.fetch<{ attribute_templates: AttributeTemplate[] }>("/admin/attribute-templates", {
        query: { limit: 100 },
      }),
  })
  const save = useMutation({
    mutationFn: (form: ProductAttributesForm) =>
      sdk.client.fetch<ProductAttributes>(
        `/admin/products/${encodeURIComponent(productId)}/attributes`,
        {
          method: "POST",
          body: form,
        }
      ),
    onSuccess: async (saved) => {
      toast.success(t("qticaret.attributes.saved"))
      onSaved(saved)
      await client.invalidateQueries({ queryKey: key })
    },
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })
  return { attributes, templates, save }
}
