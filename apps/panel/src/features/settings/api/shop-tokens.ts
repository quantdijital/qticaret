import { queryOptions, useQuery } from "@tanstack/react-query"
import type { ShopToken, ShopTokenValues } from "@/features/settings/shop-tokens"
import { sdk } from "@/lib/sdk"

export const SHOP_TOKENS_KEY = ["shop-tokens"] as const

interface ShopTokensResponse {
  tokens: { name: ShopToken; value: string | null }[]
}

/** GET /admin/shop-tokens (adr/0048): each detail with what the storefront shows for it now. */
export const shopTokensQuery = () =>
  queryOptions({
    queryKey: SHOP_TOKENS_KEY,
    queryFn: () => sdk.client.fetch<ShopTokensResponse>("/admin/shop-tokens"),
    staleTime: 30_000,
  })

/** The details' values by name, asked only while `enabled` (a menu open, a token in a text). */
export function useShopTokenValues(enabled: boolean): ShopTokenValues | undefined {
  const { data } = useQuery({ ...shopTokensQuery(), enabled })
  return data ? Object.fromEntries(data.tokens.map(({ name, value }) => [name, value])) : undefined
}
