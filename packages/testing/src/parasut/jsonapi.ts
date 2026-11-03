import type { Reply } from "../geliver/routes"

/** Paraşüt's JSON:API shapes as the fake keeps and serves them (API v4). */

export type Relations = Record<string, { data: { id: string; type: string } | null } | undefined>

export interface FakeSalesInvoice {
  id: string
  attributes: Record<string, unknown>
  contact_id: string | null
  details: Record<string, unknown>[]
  active: { id: string; type: "e_archives" | "e_invoices" } | null
  cancelled: boolean
}

export interface FakeEDocument {
  id: string
  type: "e_archives" | "e_invoices"
  invoice_id: string
  attributes: Record<string, unknown>
  pdf_asks: number
  /** When it was issued (ms), for the printed invoice's time. */
  issued_at?: number
}

export interface FakeJob {
  id: string
  status: "pending" | "running" | "done" | "error"
  errors: string[]
  invoice_id: string
  type: "e_archives" | "e_invoices"
  /** What the job was asked to write: `internet_sale`, `shipment`, `scenario`, `to`. */
  attributes: Record<string, unknown>
}

export const jsonApiError = (status: number, title: string, detail = title): Reply => ({
  status,
  body: { errors: [{ title, detail }] },
})

export const resource = (
  type: string,
  id: string,
  attributes: Record<string, unknown>,
  relationships?: Relations
) => ({ id, type, attributes, ...(relationships ? { relationships } : {}) })

/** A request's `data`: its attributes and its relationships. */
export function dataOf(body: Record<string, unknown>): {
  attributes: Record<string, unknown>
  relationships: Relations
} {
  const data = (body["data"] ?? {}) as {
    attributes?: Record<string, unknown>
    relationships?: Relations
  }
  return { attributes: data.attributes ?? {}, relationships: data.relationships ?? {} }
}

/** Lines sent inside `relationships.details.data[]`, each with its own attributes. */
export function linesOf(relationships: Relations): Record<string, unknown>[] {
  const details = relationships["details"] as unknown as
    { data?: { attributes?: Record<string, unknown> }[] } | undefined
  return (details?.data ?? []).map((line) => line.attributes ?? {})
}

const lira = (value: number) => (Math.round(value * 100) / 100).toFixed(2)

/** An invoice's totals, as Paraşüt sums its lines: each line rounded to the kuruş. */
export function totalsOf(details: Record<string, unknown>[]) {
  let net = 0
  let vat = 0
  for (const line of details) {
    const discount = line["discount_type"] === "amount" ? Number(line["discount_value"] ?? 0) : 0
    const lineNet =
      Math.round((Number(line["quantity"]) * Number(line["unit_price"]) - discount) * 100) / 100
    net += lineNet
    vat += Math.round(lineNet * Number(line["vat_rate"])) / 100
  }
  return { net_total: lira(net), total_vat: lira(vat), gross_total: lira(net + vat) }
}
