import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A KDV rate (adr/0007): the default taxes products on no VAT type, the others their own type. */
export interface VatRate {
  id: string
  code: string | null
  name: string
  rate: number
  product_type_id: string | null
  product_type_name: string | null
  /** Products taxed at it; the default's are those on no other rate's type. */
  products: number
  /** False once removed: listed so it can be brought back. */
  active: boolean
}

export interface VatRates {
  region_id: string
  default: { id: string; code: string | null; name: string; rate: number } | null
  rates: VatRate[]
}

export const VAT_RATES_KEY = ["settings", "vat-rates"] as const

/** `GET /admin/vat-rates`: every role reads them; the product forms choose from them. */
export const vatRatesQuery = () =>
  queryOptions({
    queryKey: VAT_RATES_KEY,
    queryFn: () => sdk.client.fetch<VatRates>("/admin/vat-rates"),
    staleTime: 5 * 60_000,
  })

/** "10", "8,5": a percentage as the shop writes it. */
export const percentText = (rate: number): string =>
  String(Math.round(rate * 100) / 100).replace(".", ",")

/** "KDV %8,5": the name a new rate is offered. */
export const vatNameOf = (rate: number): string => `KDV %${percentText(rate)}`

/** The rate's name, its percentage after it unless the name says it already. */
export const vatLabelOf = (rate: Pick<VatRate, "name" | "rate">): string => {
  const percent = `%${percentText(rate.rate)}`
  return rate.name.includes(percent) ? rate.name : `${rate.name} (${percent})`
}

function useVatMutation<Input>(request: (input: Input) => Promise<VatRates>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSuccess: (rates) => {
      client.setQueryData(VAT_RATES_KEY, rates)
    },
    onSettled: () => client.invalidateQueries({ queryKey: VAT_RATES_KEY }),
  })
}

export const useAddVatRate = () =>
  useVatMutation((input: { rate: number; name: string }) =>
    sdk.client.fetch<VatRates>("/admin/vat-rates", { method: "POST", body: input })
  )

/** Renamed, removed (`active: false`) or brought back (`active: true`). */
export const useUpdateVatRate = () =>
  useVatMutation(({ id, ...body }: { id: string; name?: string; active?: boolean }) =>
    sdk.client.fetch<VatRates>(`/admin/vat-rates/${encodeURIComponent(id)}`, {
      method: "POST",
      body,
    })
  )

export const useSetDefaultVatRate = () =>
  useVatMutation((rateId: string) =>
    sdk.client.fetch<VatRates>("/admin/vat-rates/default", {
      method: "POST",
      body: { rate_id: rateId },
    })
  )
