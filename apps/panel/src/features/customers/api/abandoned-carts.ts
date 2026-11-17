import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

export const ABANDONED_PAGE_SIZE = 20

type Consent = "granted" | "revoked" | null

export interface AbandonedCartLine {
  title: string
  variant: string | null
  quantity: number
  thumbnail: string | null
}

/** A cart left behind (2026-11-06): its shopper, lines, value, last activity, reminder and consent. */
export interface AbandonedCart {
  id: string
  name: string | null
  email: string | null
  /** Masked in the list; the window has it whole. */
  phone_masked: string | null
  customer: { id: string; has_account: boolean } | null
  lines: AbandonedCartLine[]
  line_count: number
  total: number
  currency_code: string
  updated_at: string
  reminder: { outcome: string; at: string; returned: boolean } | null
  consent: { email: Consent; sms: Consent }
}

export type EmailReminderBlock =
  | "no_email"
  | "wholesale"
  | "reminded"
  | "no_consent"
  | "suppressed"
  | "reminded_lately"
  | "no_storefront"

export interface AbandonedCartDetail extends AbandonedCart {
  phone: string | null
  actions: { email_block: EmailReminderBlock | null; whatsapp: string | null }
}

const KEY = ["abandoned-carts"] as const

/** The carts left behind in the last 30 days, newest activity first: a recorded read. */
export const abandonedCartsQuery = (page: number) =>
  queryOptions({
    queryKey: [...KEY, "list", page],
    queryFn: () =>
      sdk.client.fetch<{ carts: AbandonedCart[]; count: number }>("/admin/abandoned-carts", {
        query: { limit: ABANDONED_PAGE_SIZE, offset: page * ABANDONED_PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  })

export const abandonedCartQuery = (id: string) =>
  queryOptions({
    queryKey: [...KEY, "detail", id],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ cart: AbandonedCartDetail }>(
          `/admin/abandoned-carts/${encodeURIComponent(id)}`
        )
      ).cart,
  })

/** "E-posta ile hatırlat": the cart's one reminder, where its shopper consented. */
export function useRemindCart(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ outcome: string }>(
        `/admin/abandoned-carts/${encodeURIComponent(id)}/remind`,
        { method: "POST", body: {} }
      ),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

/** A wa.me link with a neutral text: no price, no link, nothing the shopper did not see. */
export const whatsappLink = (digits: string, text: string): string =>
  `https://wa.me/${encodeURIComponent(digits)}?text=${encodeURIComponent(text)}`
