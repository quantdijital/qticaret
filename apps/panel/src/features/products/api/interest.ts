import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** How many customers keep the product and wait for it to come back (F10.4–F10.5). */
export interface ProductInterest {
  wishlist: number
  stock_alerts: { variant_id: string; title: string | null; waiting: number }[]
}

export const interestQuery = (productId: string) =>
  queryOptions({
    queryKey: ["products", productId, "interest"],
    queryFn: () =>
      sdk.client.fetch<ProductInterest>(
        `/admin/products/${encodeURIComponent(productId)}/interest`
      ),
  })
