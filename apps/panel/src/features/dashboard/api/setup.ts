import { queryOptions } from "@tanstack/react-query"
import { hasSetupPayment } from "@qticaret/types/control-plane"
import { sdk } from "@/lib/sdk"
import type { SetupFacts } from "@/features/dashboard/setup-steps"
import { fetchProviderAccounts } from "@/features/settings/api/payments"

const COUNT_ONLY = { limit: 1, fields: "id" } as const

/** Light reads only (one row, ids): nothing personal, no audit record. */
async function loadSetupFacts(): Promise<SetupFacts> {
  const [{ stores }, regions, locations, shippingOptions, published, payments] = await Promise.all([
    sdk.admin.store.list(),
    sdk.admin.region.list(COUNT_ONLY),
    sdk.admin.stockLocation.list(COUNT_ONLY),
    sdk.admin.shippingOption.list(COUNT_ONLY),
    sdk.admin.product.list({ ...COUNT_ONLY, status: ["published"] }),
    fetchProviderAccounts(),
  ])
  const store = stores[0]
  return {
    storeName: store?.name ?? null,
    hasDefaultCurrency:
      store?.supported_currencies.some((currency) => currency.is_default) ?? false,
    regionCount: regions.count,
    locationCount: locations.count,
    shippingOptionCount: shippingOptions.count,
    // A card provider (PayTR, iyzico), saved and usable: the rule the usage report shares (Ek C21)
    paymentConnected: hasSetupPayment(payments.accounts),
    publishedProductCount: published.count,
  }
}

export const setupFactsQuery = () =>
  queryOptions({
    queryKey: ["dashboard", "setup"],
    queryFn: loadSetupFacts,
    // Coming back from a settings screen should show the step just completed
    staleTime: 0,
  })
