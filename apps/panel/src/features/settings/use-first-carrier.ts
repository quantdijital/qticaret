import { useQuery } from "@tanstack/react-query"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import type { OptionCarrier } from "@/features/settings/components/shipping-option-editor"
import { SHIPPING_CARRIERS } from "@/features/settings/shipping-carriers"

/** A new option's carrier: the first one the shop connected, else its own delivery. */
export function useFirstCarrier(): OptionCarrier {
  const accounts = useQuery(providerAccountsQuery()).data?.accounts ?? []
  const connected = SHIPPING_CARRIERS.find(({ id }) =>
    accounts.some((account) => account.provider === id && account.state !== "not_configured")
  )
  return connected?.id ?? "manual"
}
