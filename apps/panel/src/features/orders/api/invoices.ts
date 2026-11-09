import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { responseFailure } from "@/lib/errors"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

/** An invoice record (F8, adr/0034): no buyer in it. */
export interface InvoiceRecord {
  id: string
  order_id: string
  kind: "sale" | "return"
  /** A sale of what an exchange sent instead (E6b): its own invoice beside the order's first. */
  for_exchange?: boolean
  /** An invoice a test program issued on a development database may still name it: shown as "—". */
  provider: "parasut" | "external"
  status: "pending" | "issuing" | "issued" | "failed" | "cancelled" | "waived"
  /** A sale's e-document; a return's gider pusulası or a company's return invoice. */
  document_type: "e_invoice" | "e_archive" | "expense_voucher" | "return_invoice" | null
  number: string | null
  uuid: string | null
  issued_at: string | null
  cancellable_until: string | null
  attempts: number
  last_error: string | null
  has_pdf: boolean
  total: string
  /**
   * A sale's gift card lines, kept off the invoice: money taken in advance
   * (avans, adr/0025 Ek 2026-11-03), exact lira; null when it sold none.
   */
  advance?: string | null
  program_difference: number | null
  created_at: string
  /**
   * No document needed: a return's exception (the accountant's), or a sale
   * of gift cards alone (`advance_only`: no invoice, its money an advance).
   */
  waived_reason?: WaiverReason | typeof ADVANCE_ONLY | null
  /** In a list: the order's number. */
  order_display_id?: number | null
}

/**
 * Why an order has no sale invoice (the server's rule, adr/0034 §8):
 * invoicing off, the order canceled, paid in a provider's test mode, sold
 * in another currency; or what it waits for.
 */
export type SaleHoldReason =
  | "off"
  | "canceled"
  | "test_payment"
  | "currency"
  | "awaiting_payment"
  | "awaiting_shipment"
  | "awaiting_delivery"

export interface SaleHold {
  reason: SaleHoldReason
  /** The provider whose test mode took the payment (`pp_paytr_paytr`), for `test_payment`. */
  payment_provider: string | null
}

export interface InvoicePage {
  invoices: InvoiceRecord[]
  count: number
  limit: number
  offset: number
  /** One order's invoices without its own sale invoice: why not; null when nothing holds it. */
  sale_hold?: SaleHold | null
}

export const INVOICE_STATUSES = [
  "failed",
  "pending",
  "issuing",
  "issued",
  "cancelled",
  "waived",
] as const
/** The exceptions staff may pick for a return's document. */
export const WAIVER_REASONS = ["payment_institution", "signed_return_section"] as const
export type WaiverReason = (typeof WAIVER_REASONS)[number]
/** A sale of gift cards alone: no invoice, its money an advance (adr/0025 Ek 2026-11-03). */
export const ADVANCE_ONLY = "advance_only"

/** The advance a sale kept off its invoice, when there is one (more than zero). */
export const advanceOf = (invoice: Pick<InvoiceRecord, "advance">): string | null =>
  invoice.advance && Number(invoice.advance) > 0 ? invoice.advance : null
export const INVOICE_PAGE_SIZE = 20
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

const KEY = ["invoices"] as const

export const orderInvoicesQuery = (orderId: string) =>
  queryOptions({
    queryKey: [...KEY, "order", orderId],
    queryFn: () =>
      sdk.client.fetch<InvoicePage>("/admin/invoices", { query: { order_id: orderId, limit: 20 } }),
  })

export const invoicesQuery = (filters: { status?: InvoiceStatus; offset: number; limit: number }) =>
  queryOptions({
    queryKey: [...KEY, "list", filters],
    queryFn: () =>
      sdk.client.fetch<InvoicePage>("/admin/invoices", {
        query: {
          limit: filters.limit,
          offset: filters.offset,
          ...(filters.status ? { status: filters.status } : {}),
        },
      }),
  })

const path = (id: string, action?: string) =>
  `/admin/invoices/${encodeURIComponent(id)}${action ? `/${action}` : ""}`

function useInvoiceMutation<T>(run: (input: T) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

/** A stopped invoice tried again from where it stopped. */
export const useRetryInvoice = () =>
  useInvoiceMutation((id: string) =>
    sdk.client.fetch(path(id, "retry"), { method: "POST", body: {} })
  )

/** One picked invoice's outcome: retried, or why not (an i18n key and its sentence). */
export interface RetryResult {
  invoice_id: string
  ok: boolean
  error: string | null
  message: string | null
}

/** The most stopped invoices tried again at once (the server's `MAX_BULK_RETRY`). */
export const MAX_BULK_RETRY = 20

/** The stopped invoices picked on the queue, each tried again as its own retry would. */
export function useRetryInvoices() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) =>
      (
        await sdk.client.fetch<{ results: RetryResult[] }>("/admin/invoices/retry", {
          method: "POST",
          body: { invoice_ids: ids },
        })
      ).results,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

export interface WrittenInvoice {
  number: string
  uuid?: string | null
  document_type: "e_invoice" | "e_archive"
  issued_at: string
}

/** An invoice issued elsewhere (the shop's own program, by hand), its number written back. */
export const useWriteBackInvoice = () =>
  useInvoiceMutation(({ id, issued }: { id: string; issued: WrittenInvoice }) =>
    sdk.client.fetch(path(id, "issued"), { method: "POST", body: issued })
  )

async function failed(response: Response): Promise<never> {
  // The shape `errorText` reads from the SDK's errors, the key and a provider's words kept
  throw await responseFailure(response)
}

/** A return's document entered by staff: a gider pusulası's serial or a company's return invoice number. */
export const useRecordReturnDocument = () =>
  useInvoiceMutation(
    ({ id, number, issued_at }: { id: string; number: string; issued_at: string }) =>
      sdk.client.fetch(path(id, "return-document"), { method: "POST", body: { number, issued_at } })
  )

/** A return that needs no document of its own, and why. */
export const useWaiveReturnDocument = () =>
  useInvoiceMutation(({ id, reason }: { id: string; reason: WaiverReason }) =>
    sdk.client.fetch(path(id, "waive"), { method: "POST", body: { reason } })
  )

/** Its PDF, sent as it is: the SDK would send a body as JSON. */
export const useUploadInvoicePdf = () =>
  useInvoiceMutation(async ({ id, file }: { id: string; file: File }) => {
    const response = await fetch(path(id, "pdf"), {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/pdf" },
      body: file,
    })
    if (!response.ok) {
      await failed(response)
    }
  })

/** The invoice's PDF as a link for this page (a recorded read). */
export async function invoicePdfUrl(id: string): Promise<string> {
  const response = await fetch(path(id, "pdf"), { credentials: "same-origin" })
  if (!response.ok) {
    await failed(response)
  }
  return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type: "application/pdf" }))
}

/** A line as the invoice writes it: amounts in lira as text, the unit price KDV excluded. */
export interface DraftLine {
  description: string
  quantity: number
  unit_net: string
  discount_net: string
  vat_rate: number
  net: string
  vat: string
  gross: string
}

/** The invoice the shop's program is to issue, as we computed it (adr/0034 §3, §9). */
export interface InvoiceDraft {
  order: { id: string; number: string; date: string }
  buyer: {
    kind: "person" | "company"
    name: string
    tax_id: string
    tax_office: string | null
    email: string | null
    phone: string | null
    address: string
    city: string | null
    district: string | null
    postal_code: string | null
  }
  lines: DraftLine[]
  totals: { net: string; vat: string; gross: string }
  internet_sale: {
    url: string
    payment: "card" | "bank_transfer" | "cash_on_delivery" | "gift_card" | "other"
    platform: string | null
    paid_on: string
  }
  shipment: { carrier: { title: string; tax_id: string }; shipped_on: string } | null
  /** A return's document: the sale invoice it belongs to. */
  return_of?: {
    document: "expense_voucher" | "return_invoice"
    number: string | null
    issued_on: string | null
  }
}

/**
 * The draft of an invoice the shop issues in its own program (Luca by
 * hand): the buyer with their tax id, so proved again and recorded. Read
 * when asked, never kept once nothing shows it.
 */
export function useInvoiceDraft() {
  return useMutation({
    mutationFn: (id: string) =>
      withReauth((extra) =>
        sdk.client.fetch<{
          draft: InvoiceDraft | null
          problems: string[]
          series: string | null
        }>(path(id, "draft"), {
          ...extra,
        })
      ),
    gcTime: 0,
  })
}
