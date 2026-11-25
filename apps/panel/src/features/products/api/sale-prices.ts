import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A variant's sale (adr/0086), running or to come; amounts as exact lira ("80.00"). */
export interface VariantSaleView {
  amount: string
  starts_at: string | null
  ends_at: string | null
  running: boolean
}

export interface SalePrices {
  currency_code: string
  variants: { id: string; regular: string | null; sale: VariantSaleView | null }[]
}

/** A sale set on a variant: a price in lira ("79.90") or a percentage off its own price. */
export interface SaleSet {
  variant_id: string
  amount?: string
  percent?: number
  starts_at: string | null
  ends_at: string | null
}

export interface SaleChange {
  set?: SaleSet[]
  clear?: string[]
}

const path = (productId: string) => `/admin/products/${encodeURIComponent(productId)}/sale-prices`

/** `GET /admin/products/:id/sale-prices`: each variant's own price and its sale. */
export const salePricesQuery = (productId: string) =>
  queryOptions({
    queryKey: ["products", "sale-prices", productId],
    queryFn: () => sdk.client.fetch<SalePrices>(path(productId)),
  })

/**
 * Sales set or cleared on a product's variants, all or none; the server
 * checks each against the variant's own price and works a percentage out.
 * The storefront's price, its history and the product reads follow.
 */
export function useSetSalePrices(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (change: SaleChange) =>
      sdk.client.fetch<SalePrices>(path(productId), { method: "POST", body: change }),
    onSuccess: (answer) => {
      client.setQueryData(salePricesQuery(productId).queryKey, answer)
    },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
      ])
    },
  })
}
