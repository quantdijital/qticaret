import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

/** Who issues the shop's invoices (F8, adr/0034 §1); `fake` only in development. */
export const INVOICING_PROVIDERS = ["none", "parasut", "external"] as const
export type InvoicingProvider = (typeof INVOICING_PROVIDERS)[number] | "fake"

export const INVOICE_CARRIERS = ["aras", "yurtici", "geliver", "manual"] as const
export type InvoiceCarrier = (typeof INVOICE_CARRIERS)[number]

/** The shop's `invoicing` settings section. */
export interface InvoicingSettings {
  provider: InvoicingProvider
  trigger: "shipped" | "placed"
  carriers: Partial<Record<InvoiceCarrier, { title: string; tax_id: string }>>
}

/** `GET /admin/einvoice/parasut`: whether Paraşüt can be connected, and the shop's company. */
export interface ParasutStatus {
  available: boolean
  authorize_url: string | null
  connection: {
    company_id: string
    status: "connected" | "broken"
    last_error: string | null
    connected_at: string
    checked_at: string | null
  } | null
}

const KEY = ["einvoice", "parasut"] as const
const URL = "/admin/einvoice/parasut"

export const parasutStatusQuery = () =>
  queryOptions({
    queryKey: KEY,
    queryFn: async () => (await sdk.client.fetch<{ parasut: ParasutStatus }>(URL)).parasut,
    staleTime: 30_000,
  })

/** Connects the company with the code Paraşüt's page showed; the owner proves it again. */
export function useConnectParasut() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: { company_id: string; code: string }) =>
      withReauth((extra) =>
        sdk.client.fetch<{ parasut: ParasutStatus }>(URL, { method: "POST", body, ...extra })
      ),
    onSuccess: (answer) => {
      client.setQueryData(KEY, answer.parasut)
    },
  })
}

/** Forgets the connection and its tokens; the owner proves it again. */
export function useDisconnectParasut() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () =>
      withReauth((extra) =>
        sdk.client.fetch<{ parasut: ParasutStatus }>(URL, { method: "DELETE", ...extra })
      ),
    onSuccess: (answer) => {
      client.setQueryData(KEY, answer.parasut)
    },
  })
}

/** One read of the company with a live token: whether the connection works. */
export function useCheckParasut() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      (
        await sdk.client.fetch<{ check: { ok: boolean; code: string | null } }>(`${URL}/check`, {
          method: "POST",
          body: {},
        })
      ).check,
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  })
}
