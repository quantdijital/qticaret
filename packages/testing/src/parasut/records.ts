import { randomUUID } from "node:crypto"
import type { Handler } from "../geliver/routes"
import { createDocuments } from "./documents"
import { dataOf, jsonApiError, linesOf, resource, totalsOf } from "./jsonapi"
import type { FakeSalesInvoice } from "./jsonapi"

/**
 * Paraşüt's records as API v4 serves them (JSON:API): contacts, sales
 * invoices with their lines, e-Fatura inboxes, and the e-documents made of
 * the invoices (`documents.ts`).
 */

export type { FakeEDocument, FakeJob, FakeSalesInvoice } from "./jsonapi"
export { jsonApiError } from "./jsonapi"

export function createRecords(origin: () => string, now: () => number) {
  const contacts = new Map<string, ReturnType<typeof resource>>()
  const invoices = new Map<string, FakeSalesInvoice>()
  /** VKNs (or TCKNs) with an e-Fatura inbox. */
  const inboxes = new Set<string>()
  const documents = createDocuments(invoices, origin, now)

  const invoiceView = (invoice: FakeSalesInvoice) =>
    resource(
      "sales_invoices",
      invoice.id,
      { ...invoice.attributes, ...totalsOf(invoice.details), cancelled: invoice.cancelled },
      {
        contact: { data: invoice.contact_id ? { id: invoice.contact_id, type: "contacts" } : null },
        active_e_document: { data: invoice.active },
      }
    )

  const invoiceOf = (params: string[]) => invoices.get(params[1] ?? "")

  const routes: Record<string, Handler> = {
    ...documents.routes,
    "GET /:company/contacts": ({ query }) => {
      const taxNumber = query.get("filter[tax_number]")
      const email = query.get("filter[email]")
      const found = [...contacts.values()].filter(
        (contact) =>
          (taxNumber === null || contact.attributes["tax_number"] === taxNumber) &&
          (email === null || contact.attributes["email"] === email)
      )
      return { body: { data: found, meta: { total_count: found.length } } }
    },
    "POST /:company/contacts": ({ body }) => {
      const { attributes } = dataOf(body)
      if (
        !attributes["name"] ||
        !["customer", "supplier"].includes(attributes["account_type"] as string)
      ) {
        return jsonApiError(422, "Validation Failed", "name and account_type are required")
      }
      const contact = resource("contacts", randomUUID(), attributes)
      contacts.set(contact.id, contact)
      return { status: 201, body: { data: contact } }
    },
    "POST /:company/sales_invoices": ({ body }) => {
      const { attributes, relationships } = dataOf(body)
      const details = linesOf(relationships)
      if (details.length === 0 || !attributes["issue_date"] || !attributes["item_type"]) {
        return jsonApiError(
          422,
          "Validation Failed",
          "issue_date, item_type and details are required"
        )
      }
      const invoice: FakeSalesInvoice = {
        id: randomUUID(),
        attributes,
        contact_id: relationships["contact"]?.data?.id ?? null,
        details,
        active: null,
        cancelled: false,
      }
      invoices.set(invoice.id, invoice)
      return { status: 201, body: { data: invoiceView(invoice) } }
    },
    "GET /:company/sales_invoices/:id": ({ params, query }) => {
      const invoice = invoiceOf(params)
      if (!invoice) {
        return jsonApiError(404, "Not Found")
      }
      const active = invoice.active ? documents.documents.get(invoice.active.id) : undefined
      const include = (query.get("include") ?? "").split(",").includes("active_e_document")
      return {
        body: {
          data: invoiceView(invoice),
          ...(include && active ? { included: [documents.view(active)] } : {}),
        },
      }
    },
    "DELETE /:company/sales_invoices/:id": ({ params }) => {
      const invoice = invoiceOf(params)
      if (!invoice) {
        return jsonApiError(404, "Not Found")
      }
      if (invoice.active) {
        return jsonApiError(422, "Validation Failed", "a formalized invoice cannot be deleted")
      }
      invoices.delete(invoice.id)
      return { status: 204, body: null }
    },
    "DELETE /:company/sales_invoices/:id/cancel": ({ params }) => {
      const invoice = invoiceOf(params)
      if (!invoice) {
        return jsonApiError(404, "Not Found")
      }
      const document = invoice.active ? documents.documents.get(invoice.active.id) : undefined
      if (document?.type === "e_invoices") {
        return jsonApiError(
          422,
          "Validation Failed",
          "an e-invoice cannot be cancelled by its sender"
        )
      }
      const until = document?.attributes["cancellable_until"]
      if (document && !(typeof until === "string" && Date.parse(until) > now())) {
        return jsonApiError(422, "Validation Failed", "past cancellable_until")
      }
      invoice.cancelled = true
      return { body: { data: invoiceView(invoice) } }
    },
    "GET /:company/e_invoice_inboxes": ({ query }) => {
      const vkn = query.get("filter[vkn]") ?? ""
      const inbox = resource("e_invoice_inboxes", randomUUID(), {
        vkn,
        e_invoice_address: `urn:mail:${vkn}@sahte.parasut`,
        inbox_type: "PK",
      })
      return { body: { data: inboxes.has(vkn) ? [inbox] : [] } }
    },
  }

  return {
    routes,
    invoices,
    inboxes,
    documents: documents.documents,
    jobs: documents.jobs,
    failNextJob: documents.failNextJob,
    file: documents.file,
  }
}
