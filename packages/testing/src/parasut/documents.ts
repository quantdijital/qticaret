import { randomUUID } from "node:crypto"
import { tinyPdf } from "../pdf"
import type { FakeRequest, Handler, Reply } from "../geliver/routes"
import { dataOf, jsonApiError, resource } from "./jsonapi"
import type { FakeEDocument, FakeJob, FakeSalesInvoice } from "./jsonapi"

/**
 * The e-Fatura or e-Arşiv a job makes of a sales invoice (API v4): the
 * job moves one step each time it is read (pending, running, done) and,
 * done, leaves the e-document on the invoice. A PDF is 204 on the first
 * ask, a link valid for an hour after.
 */

const PAYMENT_TYPES = ["KREDIKARTI/BANKAKARTI", "EFT/HAVALE", "KAPIDAODEME", "ODEMEARACISI"]
const DAY_MS = 86_400_000

export function createDocuments(
  invoices: Map<string, FakeSalesInvoice>,
  origin: () => string,
  now: () => number
) {
  const documents = new Map<string, FakeEDocument>()
  const jobs = new Map<string, FakeJob>()
  const failures: string[][] = []
  let sequence = 0

  const view = (document: FakeEDocument) =>
    resource(document.type, document.id, document.attributes)

  const start =
    (type: FakeJob["type"], relation: string): Handler =>
    (request: FakeRequest) => {
      const { attributes, relationships } = dataOf(request.body)
      const invoice = invoices.get(relationships[relation]?.data?.id ?? "")
      if (!invoice || invoice.cancelled) {
        return jsonApiError(422, "Validation Failed", `${relation} not found`)
      }
      if (invoice.active) {
        return jsonApiError(422, "Validation Failed", "invoice already formalized")
      }
      if (type === "e_archives") {
        const sale = attributes["internet_sale"] as Record<string, unknown> | undefined
        if (sale && !PAYMENT_TYPES.includes(sale["payment_type"] as string)) {
          return jsonApiError(422, "Validation Failed", "internet_sale.payment_type invalid")
        }
      } else if (
        !attributes["to"] ||
        !["basic", "commercial"].includes(attributes["scenario"] as string)
      ) {
        return jsonApiError(422, "Validation Failed", "to and scenario are required")
      }
      const job: FakeJob = {
        id: randomUUID(),
        status: "pending",
        errors: failures.shift() ?? [],
        invoice_id: invoice.id,
        type,
        attributes,
      }
      jobs.set(job.id, job)
      return {
        status: 201,
        body: { data: resource("trackable_jobs", job.id, { status: "pending", errors: [] }) },
      }
    }

  function advance(job: FakeJob) {
    if (job.status === "pending") {
      job.status = "running"
      return
    }
    const invoice = invoices.get(job.invoice_id)
    if (job.status !== "running" || !invoice) {
      return
    }
    if (job.errors.length > 0) {
      job.status = "error"
      return
    }
    sequence += 1
    const document: FakeEDocument = {
      id: randomUUID(),
      type: job.type,
      invoice_id: invoice.id,
      attributes: {
        uuid: randomUUID(),
        invoice_number: `SHT${String(new Date(now()).getUTCFullYear())}${String(sequence).padStart(9, "0")}`,
        status: job.type === "e_archives" ? "sent" : "successful",
        ...(job.type === "e_archives"
          ? { cancellable_until: new Date(now() + 7 * DAY_MS).toISOString() }
          : {}),
      },
      pdf_asks: 0,
    }
    documents.set(document.id, document)
    invoice.active = { id: document.id, type: job.type }
    job.status = "done"
  }

  const read =
    (type: FakeEDocument["type"]): Handler =>
    ({ params }) => {
      const document = documents.get(params[1] ?? "")
      return document?.type === type
        ? { body: { data: view(document) } }
        : jsonApiError(404, "Not Found")
    }

  const pdf =
    (type: FakeEDocument["type"]): Handler =>
    ({ params }) => {
      const document = documents.get(params[1] ?? "")
      if (document?.type !== type) {
        return jsonApiError(404, "Not Found")
      }
      document.pdf_asks += 1
      if (document.pdf_asks === 1) {
        return { status: 204, body: null }
      }
      return {
        body: {
          data: resource("e_document_pdfs", document.id, {
            url: `${origin()}/pdfs/${document.id}.pdf`,
            expires_at: new Date(now() + 3600_000).toISOString(),
          }),
        },
      }
    }

  const routes: Record<string, Handler> = {
    "POST /:company/e_archives": start("e_archives", "sales_invoice"),
    "POST /:company/e_invoices": start("e_invoices", "invoice"),
    "GET /:company/trackable_jobs/:id": ({ params }) => {
      const job = jobs.get(params[1] ?? "")
      if (!job) {
        return jsonApiError(404, "Not Found")
      }
      advance(job)
      const errors = job.status === "error" ? job.errors : []
      return { body: { data: resource("trackable_jobs", job.id, { status: job.status, errors }) } }
    },
    "GET /:company/e_archives/:id": read("e_archives"),
    "GET /:company/e_invoices/:id": read("e_invoices"),
    "GET /:company/e_archives/:id/pdf": pdf("e_archives"),
    "GET /:company/e_invoices/:id/pdf": pdf("e_invoices"),
  }

  return {
    routes,
    documents,
    jobs,
    view,
    /** The next job started ends in an error with these messages. */
    failNextJob: (errors: string[]) => {
      failures.push(errors)
    },
    /** The PDF behind a link the API gave. */
    file: (id: string): Reply =>
      documents.has(id)
        ? { body: null, bytes: { type: "application/pdf", data: tinyPdf(`SAHTE FATURA ${id}`) } }
        : jsonApiError(404, "Not Found"),
  }
}
