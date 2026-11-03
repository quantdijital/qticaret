import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { PickerOption } from "@/components/patterns/search-picker"
import { customerName } from "@/features/customers/names"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"
import type {
  LinkInput,
  LinkPreview,
  LinkShare,
  LinkStatus,
  PaymentLink,
  PaymentLinkList,
  PaymentLinkSummary,
  PreviewInput,
  ResendChannel,
  ResendOutcomes,
} from "./types"

export const LINK_PAGE_SIZE = 50

const KEY = "payment-links"
const BASE = "/admin/payment-links"
const path = (id: string, action?: string) =>
  `${BASE}/${encodeURIComponent(id)}${action ? `/${action}` : ""}`

export interface LinkListParams {
  status: LinkStatus | null
  /** "İndirimli bağlantılar" (adr/0051 §10): true only those with one, false only those without. */
  discounted: boolean | null
  createdBy: string | null
  page: number
}

/** The list, newest first, filtered by the server; a recorded read. */
export const paymentLinksQuery = ({ status, discounted, createdBy, page }: LinkListParams) =>
  queryOptions({
    queryKey: [KEY, "list", { status, discounted, createdBy, page }],
    queryFn: () =>
      sdk.client.fetch<PaymentLinkList>(BASE, {
        query: {
          ...(status ? { status } : {}),
          ...(discounted === null ? {} : { discounted: String(discounted) }),
          ...(createdBy ? { created_by: createdBy } : {}),
          limit: LINK_PAGE_SIZE,
          offset: page * LINK_PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  })

export const paymentLinkQuery = (id: string) =>
  queryOptions({
    queryKey: [KEY, "detail", id],
    queryFn: async () =>
      (await sdk.client.fetch<{ payment_link: PaymentLink }>(path(id))).payment_link,
  })

export const linkShareQuery = (id: string) =>
  queryOptions({
    queryKey: [KEY, "share", id],
    queryFn: async () => (await sdk.client.fetch<{ share: LinkShare }>(path(id, "share"))).share,
  })

/**
 * The new-order form's summary as the backend prices it; nothing is
 * written. The last answer stays on screen while the next one comes.
 */
export const linkPreviewQuery = (input: PreviewInput | null) =>
  queryOptions({
    queryKey: [KEY, "preview", input],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ preview: LinkPreview }>(`${BASE}/preview`, {
          method: "POST",
          body: input ?? {},
        })
      ).preview,
    enabled: input !== null,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    // A refusal (a discount over the limit, a variant without a price) is an answer, not a hiccup
    retry: false,
  })

/** Customers to make a link for, by name or e-mail (a recorded read, as the customer list). */
export async function searchCustomers(q: string): Promise<PickerOption[]> {
  const { customers } = await sdk.admin.customer.list({
    ...(q ? { q } : {}),
    limit: 20,
    fields: "id,first_name,last_name,email,company_name",
  })
  return customers.map((customer) => ({
    id: customer.id,
    label: [customerName(customer), customer.email].filter(Boolean).join(" · "),
    // The backend refuses a customer without an address to send the link to
    inactive: !customer.email,
  }))
}

function useChanged() {
  const client = useQueryClient()
  return (id?: string) => {
    void client.invalidateQueries({ queryKey: [KEY, "list"] })
    if (id) {
      void client.invalidateQueries({ queryKey: [KEY, "detail", id] })
      void client.invalidateQueries({ queryKey: [KEY, "share", id] })
    }
  }
}

export interface MadeLink {
  payment_link: PaymentLink
  share: LinkShare
}

/** "Bağlantı oluştur": the person proves themselves again (428 → the dialog). */
export function useCreatePaymentLink() {
  const client = useQueryClient()
  const changed = useChanged()
  return useMutation({
    mutationFn: (input: LinkInput) =>
      withReauth((extra) =>
        sdk.client.fetch<MadeLink>(BASE, { method: "POST", body: input, ...extra })
      ),
    onSuccess: (made) => {
      // The detail page opens on what the answer carries, without reading it again
      client.setQueryData(paymentLinkQuery(made.payment_link.id).queryKey, made.payment_link)
      client.setQueryData(linkShareQuery(made.payment_link.id).queryKey, made.share)
      changed()
    },
  })
}

/** Owner and admin: an open or draft link closed, its code with it. */
export function useCancelPaymentLink(id: string) {
  const changed = useChanged()
  return useMutation({
    mutationFn: async () =>
      (
        await sdk.client.fetch<{ payment_link: PaymentLinkSummary }>(path(id, "cancel"), {
          method: "POST",
          body: {},
        })
      ).payment_link,
    onSuccess: () => {
      changed(id)
    },
  })
}

/** Owner and admin: an open link's end `hours` from now, never past its seventh day. */
export function useExtendPaymentLink(id: string) {
  const changed = useChanged()
  return useMutation({
    mutationFn: async (hours: number) =>
      (
        await sdk.client.fetch<{ payment_link: PaymentLinkSummary }>(path(id, "extend"), {
          method: "POST",
          body: { hours },
        })
      ).payment_link,
    onSuccess: () => {
      changed(id)
    },
  })
}

/** "E-postayla gönder", "SMS ile gönder": once in ten minutes a link. */
export function useResendPaymentLink(id: string) {
  const changed = useChanged()
  return useMutation({
    mutationFn: async (channels: ResendChannel[]) =>
      (
        await sdk.client.fetch<{ outcomes: ResendOutcomes }>(path(id, "resend"), {
          method: "POST",
          body: { channels },
        })
      ).outcomes,
    onSuccess: () => {
      changed(id)
    },
  })
}
