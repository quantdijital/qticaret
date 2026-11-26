import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

/** Who issues the shop's invoices (F8, adr/0034 §1; BirFatura pulls them, adr/0072). */
export const INVOICING_PROVIDERS = ["none", "parasut", "birfatura", "external"] as const
export type InvoicingProvider = (typeof INVOICING_PROVIDERS)[number]

/**
 * The program as the panel shows it: a stored value it does not offer (a
 * test program picked on a development database) reads as none, which is
 * what the server does with it.
 */
export function invoicingProviderOf(value: string): InvoicingProvider {
  return (INVOICING_PROVIDERS as readonly string[]).includes(value)
    ? (value as InvoicingProvider)
    : "none"
}

export const INVOICE_CARRIERS = ["aras", "yurtici", "dhlecommerce", "manual"] as const
export type InvoiceCarrier = (typeof INVOICE_CARRIERS)[number]

/** The shop's `invoicing` settings section. */
export interface InvoicingSettings {
  /** Read it with `invoicingProviderOf`: an old development value may still come back. */
  provider: InvoicingProvider
  trigger: "shipped" | "placed"
  carriers: Partial<Record<InvoiceCarrier, { title: string; tax_id: string }>>
  /** The web sales' invoice series (three characters), apart from invoices issued by hand. */
  series: string | null
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

/**
 * Whether Paraşüt is offered: only once the platform has opened it (docs/06
 * principle 10). Unknown (loading, or a role that may not read it) is no.
 */
export function useParasutOffered(): boolean {
  return useQuery(parasutStatusQuery()).data?.available === true
}

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

/**
 * `GET /admin/einvoice/birfatura` (adr/0072): whether a connection password
 * was made and when, and BirFatura's last pull. Never the password itself.
 */
export interface BirfaturaStatus {
  /** "unreadable": the server's key changed and the password no longer opens; make a new one. */
  token: { state: string; made_at: string } | null
  last_pull: { at: string; orders: number } | null
}

const BIRFATURA_KEY = ["einvoice", "birfatura"] as const
const BIRFATURA_URL = "/admin/einvoice/birfatura"

export const birfaturaStatusQuery = () =>
  queryOptions({
    queryKey: BIRFATURA_KEY,
    queryFn: async () =>
      (await sdk.client.fetch<{ birfatura: BirfaturaStatus }>(BIRFATURA_URL)).birfatura,
    staleTime: 30_000,
  })

/** The address typed into BirFatura: the backend shares the panel's origin (adr/0022 §4). */
export const birfaturaSiteUrl = (origin: string): string => `${origin}/hooks/birfatura`

/**
 * Makes the connection password, or a new one in its place (the old one
 * stops at once); the owner proves it again. The password comes back in
 * this answer only and is never put in the query cache. The mutation that
 * holds it is dropped from the mutation cache as soon as nothing observes
 * it (`gcTime: 0`): once the dialog closes and resets it, it is gone.
 */
export function useMakeBirfaturaToken() {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: () =>
      withReauth((extra) =>
        sdk.client.fetch<{ token: string; birfatura: BirfaturaStatus }>(`${BIRFATURA_URL}/token`, {
          method: "POST",
          body: {},
          ...extra,
        })
      ),
    onSuccess: (answer) => {
      client.setQueryData(BIRFATURA_KEY, answer.birfatura)
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
