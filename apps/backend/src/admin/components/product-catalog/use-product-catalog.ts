import { toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import type { CatalogBody, ProductCatalog } from "../../lib/catalog"
import { errorText } from "../../lib/errors"
import { sdk } from "../../lib/sdk"

/**
 * The product's catalog fields and their save. `productVersion` changes
 * when the product page has new data (a category or variant added in the
 * core screens), so the lists here follow it. A save puts the stored fields
 * in the cache at once, so the form starts again from them.
 */
export function useProductCatalog(productId: string, productVersion: string) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const key = ["qticaret", "product-catalog", productId, productVersion]
  const url = `/admin/products/${encodeURIComponent(productId)}/catalog`
  const catalog = useQuery({
    queryKey: key,
    queryFn: () => sdk.client.fetch<ProductCatalog>(url),
  })
  const save = useMutation({
    mutationFn: (body: CatalogBody) =>
      sdk.client.fetch<ProductCatalog>(url, { method: "POST", body }),
    onSuccess: (saved) => {
      toast.success(t("qticaret.catalog.saved"))
      client.setQueryData(key, saved)
    },
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })
  return { catalog, save }
}

export type CatalogSave = ReturnType<typeof useProductCatalog>["save"]
