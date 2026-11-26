import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The shop's shipping options by name (cash on delivery's couriers, F6). */
export const shippingOptionNamesQuery = () =>
  queryOptions({
    queryKey: ["settings", "shipping-options", "names"],
    queryFn: async () =>
      (await sdk.admin.shippingOption.list({ fields: "id,name", limit: 100 })).shipping_options,
  })

/** A shipping option as Settings > Shipping lists it (F7.8); a flat amount in lira. */
export interface ShopShippingOption {
  id: string
  name: string
  /** Null for an option the panel does not know (an old one). */
  carrier: "manual" | "aras" | "yurtici" | "dhlecommerce" | "surat" | "pickup" | null
  pricing: "flat" | "table"
  amount: string | null
  in_store: boolean
}

/** What a new option is: who carries it and how it is priced (the server checks the pair). */
export interface NewShippingOption {
  name: string
  carrier: "manual" | "aras" | "yurtici" | "dhlecommerce" | "surat" | "pickup"
  pricing: { type: "flat"; amount: number } | { type: "table" }
}

const OPTIONS_KEY = ["settings", "shipping-options"] as const
const optionsUrl = "/admin/shipping-setup/options"

export const shopShippingOptionsQuery = () =>
  queryOptions({
    queryKey: [...OPTIONS_KEY, "shop"],
    queryFn: async () =>
      (await sdk.client.fetch<{ options: ShopShippingOption[] }>(optionsUrl)).options,
  })

function useOptionMutation<T>(run: (input: T) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: OPTIONS_KEY })
    },
  })
}

export const useCreateShippingOption = () =>
  useOptionMutation((body: NewShippingOption) =>
    sdk.client.fetch(optionsUrl, { method: "POST", body })
  )

export const useUpdateShippingOption = () =>
  useOptionMutation(({ id, ...body }: { id: string; name?: string; amount?: number }) =>
    sdk.client.fetch(`${optionsUrl}/${encodeURIComponent(id)}`, { method: "POST", body })
  )

export const useDeleteShippingOption = () =>
  useOptionMutation((id: string) =>
    sdk.client.fetch(`${optionsUrl}/${encodeURIComponent(id)}`, { method: "DELETE" })
  )
