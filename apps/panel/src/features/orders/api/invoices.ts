import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
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
}

export interface InvoicePage {
  invoices: InvoiceRecord[]
  count: number
  limit: number
  offset: number
}

export const INVOICE_STATUSES = ["failed", "pending", "issuing", "issued", "cancelled"] as const
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
  return URL.createObjectURL(await response.blob())
}
