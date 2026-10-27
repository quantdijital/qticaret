import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The shop's shipping options by name (cash on delivery's couriers, F6). */
export const shippingOptionNamesQuery = () =>
  queryOptions({
    queryKey: ["settings", "shipping-options", "names"],
    queryFn: async () =>
      (await sdk.admin.shippingOption.list({ fields: "id,name", limit: 100 })).shipping_options,
  })
