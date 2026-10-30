import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The contracts made with an order (F13.2), whose copies it keeps. */
export type ContractKind = "pre_information" | "distance_sales"

/** `GET /admin/orders/:id/legal`: the shopper's consent and the copies kept; null without one. */
export interface OrderConsent {
  given_at: string
  ip: string | null
  documents: { kind: ContractKind; version: number }[]
  copies: {
    kind: ContractKind
    version: number
    title: string
    html_hash: string
    created_at: string
  }[]
}

/** The age the buyer declared for a restricted product (F13.3): the limit then, and when. */
export interface OrderAgeDeclaration {
  min_age: number
  declared_at: string
}

export interface OrderLegalRecord {
  consent: OrderConsent | null
  age_declaration: OrderAgeDeclaration | null
}

/** `GET /admin/orders/:id/legal/:kind`: the copy as the order made it. */
export interface OrderContractCopy {
  kind: ContractKind
  version: number
  title: string
  html: string
  html_hash: string
  /** Whether the text still matches the hash it was kept with. */
  intact: boolean
  created_at: string
}

const base = (orderId: string) => `/admin/orders/${encodeURIComponent(orderId)}/legal`

export const orderLegalQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["orders", "legal", orderId],
    queryFn: () => sdk.client.fetch<OrderLegalRecord>(base(orderId)),
  })

export const orderContractQuery = (orderId: string, kind: ContractKind) =>
  queryOptions({
    queryKey: ["orders", "legal", orderId, kind],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ document: OrderContractCopy }>(
          `${base(orderId)}/${encodeURIComponent(kind)}`
        )
      ).document,
    // A recorded read: asked again only when the dialog opens again
    staleTime: Infinity,
    gcTime: 0,
  })
