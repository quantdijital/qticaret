import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClientOptions } from "../../clients"
import { PARASUT_PROVIDER, parasutOrigin } from "./oauth"

/**
 * Paraşüt's API v4 under `/v4/{company_id}` (JSON:API; apidocs.parasut.com
 * swagger.json): contacts, sales invoices, e-Fatura inboxes, the
 * e-Fatura or e-Arşiv a job makes of an invoice, and its PDF. At most 10
 * requests in 10 seconds: `throttle` waits its turn before each one.
 */

export type EDocumentType = "e_archives" | "e_invoices"

const Id = z.string().min(1).max(100)

const Resource = <T extends z.ZodType>(attributes: T) =>
  z.looseObject({ id: Id, type: z.string(), attributes })

const One = <T extends z.ZodType>(attributes: T) => z.looseObject({ data: Resource(attributes) })

const Many = <T extends z.ZodType>(attributes: T) =>
  z.looseObject({ data: z.array(Resource(attributes)).max(25) })

const Amount = z.union([z.string(), z.number()]).transform(String)

const InvoiceAttributes = z.looseObject({
  gross_total: Amount.optional(),
  cancelled: z.boolean().optional(),
})

const DocumentAttributes = z.looseObject({
  uuid: z.string().max(100).nullish(),
  invoice_number: z.string().max(100).nullish(),
  cancellable_until: z.string().max(50).nullish(),
})

const Invoice = z.looseObject({
  data: z.looseObject({
    id: Id,
    attributes: InvoiceAttributes,
    relationships: z
      .looseObject({
        active_e_document: z
          .looseObject({
            data: z.object({ id: Id, type: z.enum(["e_archives", "e_invoices"]) }).nullish(),
          })
          .optional(),
      })
      .optional(),
  }),
  included: z.array(Resource(DocumentAttributes)).max(10).optional(),
})

const Job = One(
  z.looseObject({
    status: z.enum(["pending", "running", "done", "error"]),
    errors: z.array(z.string().max(500)).max(20).nullish(),
  })
)

const Pdf = One(z.looseObject({ url: z.string().max(2000) }))

/** Paraşüt's word for a refusal: an OAuth `error`, or the first JSON:API error's title. */
const apiError = (body: unknown): string | undefined => {
  const errors = (body as { errors?: { title?: unknown }[] } | null)?.errors
  const title = Array.isArray(errors) ? errors[0]?.title : undefined
  return typeof title === "string"
    ? title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .slice(0, 60)
    : undefined
}

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

    /** The company's contact with this tax id, or null. */
    async findContact(token: string, taxId: string): Promise<string | null> {
      const answer = await call(token, {
        path: ["contacts"],
        query: { "filter[tax_number]": taxId, "page[size]": "1" },
        schema: Many(z.looseObject({})),
      })
      return answer.data[0]?.id ?? null
    },

    async createContact(token: string, attributes: Record<string, unknown>): Promise<string> {
      const answer = await call(token, {
        method: "POST",
        path: ["contacts"],
        json: { data: { type: "contacts", attributes } },
        schema: One(z.looseObject({})),
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
        schema: One(InvoiceAttributes),
      })
      return { id: answer.data.id, gross_total: answer.data.attributes.gross_total ?? null }
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

    /** Cancels an invoice: an e-Arşiv while it can still be (seven days). */
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
        schema: Many(z.looseObject({ e_invoice_address: z.string().max(200) })),
      })
      return answer.data[0]?.attributes.e_invoice_address ?? null
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
        schema: Job,
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
