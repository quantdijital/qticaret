import { useQuery } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"
import type { SetupFacts } from "./setup-steps"

const KEY = ["qticaret", "home"] as const
// A count needs one row at most, and ids only
const COUNT_ONLY = { limit: 1, fields: "id" }
// The dashboard caches for 90 s; coming back from a settings screen should
// show the step just completed
const FRESH = { staleTime: 0 }

export interface ProductCounts {
  published: number
  draft: number
}

/**
 * Only reads that carry no personal data: an orders or customers list would
 * write an audit record on every visit (adr/0011), so order numbers wait for
 * a summary endpoint (docs/17).
 */
async function loadSetupFacts(): Promise<SetupFacts> {
  const [{ stores }, regions, locations, shippingOptions, published] = await Promise.all([
    sdk.admin.store.list(),
    sdk.admin.region.list(COUNT_ONLY),
    sdk.admin.stockLocation.list(COUNT_ONLY),
    sdk.admin.shippingOption.list(COUNT_ONLY),
    sdk.admin.product.list({ ...COUNT_ONLY, status: ["published"] }),
  ])
  const store = stores[0]
  return {
    storeName: store?.name ?? null,
    hasDefaultCurrency:
      store?.supported_currencies.some((currency) => currency.is_default) ?? false,
    regionCount: regions.count,
    locationCount: locations.count,
    shippingOptionCount: shippingOptions.count,
    publishedProductCount: published.count,
  }
}

async function loadProductCounts(): Promise<ProductCounts> {
  const [published, draft] = await Promise.all([
    sdk.admin.product.list({ ...COUNT_ONLY, status: ["published"] }),
    sdk.admin.product.list({ ...COUNT_ONLY, status: ["draft"] }),
  ])
  return { published: published.count, draft: draft.count }
}

export function useSetupFacts() {
  return useQuery({ queryKey: [...KEY, "setup"], queryFn: loadSetupFacts, ...FRESH })
}

export function useProductCounts() {
  return useQuery({ queryKey: [...KEY, "product-counts"], queryFn: loadProductCounts, ...FRESH })
}

/** The signed-in user's first name for the greeting; null when unknown. */
export function useFirstName(): string | null {
  const { data } = useQuery({
    queryKey: [...KEY, "me"],
    queryFn: () => sdk.admin.user.me({ fields: "id,first_name" }),
  })
  const name = data?.user.first_name?.trim()
  return name === undefined || name === "" ? null : name
}

/** `GET /admin/home/summary` (docs/17): order numbers worked out on the server. */
export interface HomeSummary {
  open_orders: number
  awaiting_shipment: number
  /** More open orders than the server reads: the waiting count is a floor. */
  capped: boolean
  today: {
    orders: number
    sales: { currency_code: string; amount: string }[]
    /** More of today's orders than the server sums: the total is a floor. */
    capped: boolean
  }
}

export function useHomeSummary() {
  return useQuery({
    queryKey: [...KEY, "summary"],
    queryFn: () => sdk.client.fetch<HomeSummary>("/admin/home/summary"),
    // Worked out on the server from up to 1000 orders: not on every visit
    staleTime: 30_000,
  })
}
