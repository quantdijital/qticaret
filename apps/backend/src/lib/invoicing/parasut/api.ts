import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClientOptions } from "../../clients"
import { PARASUT_PROVIDER, parasutOrigin } from "./oauth"
import { Created, Invoice, InvoiceAttributes, Job, Many, Pdf, apiError } from "./schemas"

export { outcomeUnsure } from "./schemas"

/**
 * Paraşüt's API v4 under `/v4/{company_id}` (JSON:API; apidocs.parasut.com
 * swagger.json): contacts, sales invoices, e-Fatura inboxes, the
 * e-Fatura or e-Arşiv a job makes of an invoice, and its PDF. At most 10
 * requests in 10 seconds: `throttle` waits its turn before each one.
 */

export type EDocumentType = "e_archives" | "e_invoices"

// A path segment Paraşüt gave us (an id), never bent into another path
const SEGMENT = /^[A-Za-z0-9_-]{1,100}$/
function segment(value: string): string {
  if (!SEGMENT.test(value)) {
    throw new Error("parasut: not an id")
  }
  return value
}

export function createParasutApi(
  companyId: string,
  options: Partial<Omit<HttpClientOptions, "provider" | "baseUrl">> & {
    origin?: string
    throttle?: () => Promise<void>
  } = {}
) {
  const http = createHttpClient({
    ...options,
    baseUrl: options.origin ?? parasutOrigin(),
    provider: PARASUT_PROVIDER,
    errorCode: apiError,
  })
  const company = segment(companyId)

  async function call<T>(
    token: string,
    request: {
      method?: string
      path: string[]
      json?: unknown
      query?: Record<string, string>
      idempotent?: boolean
      schema: z.ZodType<T>
    }
  ): Promise<T> {
    await options.throttle?.()
    return http.request({
      method: request.method ?? "GET",
      path: ["v4", company, ...request.path],
      ...(request.query ? { query: request.query } : {}),
      ...(request.json === undefined ? {} : { json: request.json }),
      idempotent: request.idempotent ?? false,
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.api+json" },
      logPath: `/v4/:company/${request.path[0] ?? ""}`,
      schema: request.schema,
    })
  }

  return {
    /** Whether the token reaches the company: one contact read (403 for another's company). */
    async checkCompany(token: string): Promise<void> {
      await call(token, {
        path: ["contacts"],
        query: { "page[size]": "1" },
        schema: Many(z.looseObject({})),
      })
    },

    /**
     * The company's contact with exactly this tax id (or e-mail, any
     * case), or null. Paraşüt's filter may match part of a value: a
     * near match is never taken for the buyer.
     */
    async findContact(
      token: string,
      by: { taxNumber: string } | { email: string }
    ): Promise<string | null> {
      const filter =
        "taxNumber" in by ? { "filter[tax_number]": by.taxNumber } : { "filter[email]": by.email }
      const answer = await call(token, {
        path: ["contacts"],
        query: { ...filter, "page[size]": "25" },
        schema: Many(
          z.looseObject({ tax_number: z.string().nullish(), email: z.string().nullish() })
        ),
      })
      const exact = answer.data.find((contact) =>
        "taxNumber" in by
          ? contact.attributes.tax_number === by.taxNumber
          : contact.attributes.email?.toLowerCase() === by.email.toLowerCase()
      )
      return exact?.id ?? null
    },

    async createContact(token: string, attributes: Record<string, unknown>): Promise<string> {
      const answer = await call(token, {
        method: "POST",
        path: ["contacts"],
        json: { data: { type: "contacts", attributes } },
        schema: Created,
      })
      return answer.data.id
    },

    async createSalesInvoice(
      token: string,
      body: { attributes: Record<string, unknown>; relationships: Record<string, unknown> }
    ): Promise<{ id: string; gross_total: string | null }> {
      const answer = await call(token, {
        method: "POST",
        path: ["sales_invoices"],
        json: { data: { type: "sales_invoices", ...body } },
        schema: Created,
      })
      const totals = InvoiceAttributes.safeParse(answer.data["attributes"])
      return {
        id: answer.data.id,
        gross_total: totals.success ? (totals.data.gross_total ?? null) : null,
      }
    },

    /** The invoice, and the e-document it became (null until a job made one). */
    async readSalesInvoice(token: string, id: string) {
      const answer = await call(token, {
        path: ["sales_invoices", segment(id)],
        query: { include: "active_e_document" },
        schema: Invoice,
      })
      const active = answer.data.relationships?.active_e_document?.data ?? null
      const document = active
        ? (answer.included?.find((row) => row.id === active.id && row.type === active.type) ?? null)
        : null
      return {
        gross_total: answer.data.attributes.gross_total ?? null,
        cancelled: answer.data.attributes.cancelled === true,
        document: active && document ? { ...active, ...document.attributes } : null,
      }
    },

    /** Deletes an invoice no job made an e-document of. */
    async deleteSalesInvoice(token: string, id: string): Promise<void> {
      await call(token, {
        method: "DELETE",
        path: ["sales_invoices", segment(id)],
        idempotent: true,
        schema: z.unknown(),
      })
    },

    /** Cancels an invoice: an e-Arşiv while Paraşüt still allows it (its `cancellable_until`). */
    async cancelSalesInvoice(token: string, id: string): Promise<void> {
      await call(token, {
        method: "DELETE",
        path: ["sales_invoices", segment(id), "cancel"],
        idempotent: true,
        schema: z.unknown(),
      })
    },

    /** The e-Fatura inbox of a tax id, or null when it has none (an e-Arşiv then). */
    async inboxOf(token: string, taxId: string): Promise<string | null> {
      const answer = await call(token, {
        path: ["e_invoice_inboxes"],
        query: { "filter[vkn]": taxId },
        schema: Many(
          z.looseObject({ vkn: z.string().nullish(), e_invoice_address: z.string().max(200) })
        ),
      })
      // Only this tax id's own inbox: an e-Fatura sent to another can never be taken back
      return (
        answer.data.find((inbox) => inbox.attributes.vkn === taxId)?.attributes.e_invoice_address ??
        null
      )
    },

    /** Starts the job that makes an e-Arşiv or e-Fatura of an invoice; its id. */
    async startEDocument(
      token: string,
      type: EDocumentType,
      invoiceId: string,
      attributes: Record<string, unknown>
    ): Promise<string> {
      // Paraşüt names the invoice differently on each
      const relation = type === "e_archives" ? "sales_invoice" : "invoice"
      const answer = await call(token, {
        method: "POST",
        path: [type],
        json: {
          data: {
            type,
            attributes,
            relationships: { [relation]: { data: { id: invoiceId, type: "sales_invoices" } } },
          },
        },
        schema: Created,
      })
      return answer.data.id
    },

    async readJob(token: string, id: string) {
      const answer = await call(token, { path: ["trackable_jobs", segment(id)], schema: Job })
      return { status: answer.data.attributes.status, errors: answer.data.attributes.errors ?? [] }
    },

    /** A link to the e-document's PDF, valid for an hour; null while Paraşüt is still making it. */
    async pdfLink(token: string, type: EDocumentType, id: string): Promise<string | null> {
      const text = await call(token, {
        path: [type, segment(id), "pdf"],
        schema: z.unknown(),
      })
      if (text === undefined || text === null || text === "") {
        return null
      }
      return Pdf.parse(text).data.attributes.url
    },
  }
}

export type ParasutApi = ReturnType<typeof createParasutApi>
