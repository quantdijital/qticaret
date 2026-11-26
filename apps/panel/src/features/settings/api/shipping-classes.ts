import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The key products per shipping class are cached under (adr/0087 §4). */
export const SHIPPING_CLASS_USAGE_KEY = ["settings", "shipping-classes", "usage"] as const

/** How many products are in each shipping class, `free` included; a class nobody uses is absent. */
export const shippingClassUsageQuery = () =>
  queryOptions({
    queryKey: SHIPPING_CLASS_USAGE_KEY,
    queryFn: async () =>
      (await sdk.client.fetch<{ usage: Record<string, number> }>("/admin/shipping-setup/classes"))
        .usage,
  })

/** A new class's key: short, lower-case, never `free`; the server checks it is unique. */
export function newClassKey(taken: readonly string[]): string {
  for (;;) {
    const key = `c-${Math.random().toString(36).slice(2, 8)}`
    if (!taken.includes(key)) {
      return key
    }
  }
}
