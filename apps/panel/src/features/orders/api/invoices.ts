import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

/** An invoice record (F8, adr/0034): no buyer in it. */
export interface InvoiceRecord {
  id: string
  order_id: string
  kind: "sale" | "return"
  provider: "parasut" | "external" | "fake"
  status: "pending" | "issuing" | "issued" | "failed" | "cancelled"
  document_type: "e_invoice" | "e_archive" | null
  number: string | null
  uuid: string | null
  issued_at: string | null
  cancellable_until: string | null
  attempts: number
  last_error: string | null
  has_pdf: boolean
  total: string
  program_difference: number | null
  created_at: string
  /** In a list: the order's number. */
  order_display_id?: number | null
}

export interface InvoicePage {
  invoices: InvoiceRecord[]
  count: number
  limit: number
  offset: number
}

export const INVOICE_STATUSES = ["failed", "pending", "issuing", "issued", "cancelled"] as const
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
  const body = (await response.json().catch(() => null)) as { message?: string } | null
  // The shape `errorText` reads from the SDK's errors
  throw Object.assign(new Error(body?.message ?? "invoice request failed"), {
    status: response.status,
    message: body?.message ?? "",
  })
}

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
        sdk.client.fetch<{ draft: InvoiceDraft | null; problems: string[] }>(path(id, "draft"), {
          ...extra,
        })
      ),
    gcTime: 0,
  })
}
