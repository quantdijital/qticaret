import { invoicePdf } from "../invoice-pdf"
import type { InvoiceLine } from "../invoice-pdf"
import { totalsOf } from "./jsonapi"
import type { FakeEDocument, FakeJob, FakeSalesInvoice } from "./jsonapi"

/**
 * The PDF the local Paraşüt hands out for an e-document: the invoice the
 * shop sent, laid out as GİB's standard e-Arşiv / e-Fatura view
 * (`invoice-pdf.ts`), with the seller as the shop's Paraşüt account
 * knows it and the buyer as the contact the shop sent.
 */

/** The shop's company as its Paraşüt account holds it: the seller on every invoice. */
export interface FakeParasutCompany {
  title: string
  taxNumber: string
  taxOffice: string
  address: string
  phone?: string
  email?: string
}

export interface PrintoutInput {
  company: FakeParasutCompany
  document: FakeEDocument
  invoice: FakeSalesInvoice
  /** The contact's attributes, when the invoice names one. */
  contact: Record<string, unknown> | undefined
  /** The job that made the document: `internet_sale`, `shipment`, `scenario`. */
  job: FakeJob | undefined
}

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"]
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"]

function hundreds(value: number): string {
  const hundred = Math.floor(value / 100)
  const head = hundred === 0 ? "" : hundred === 1 ? "yüz" : `${ONES[hundred] ?? ""} yüz`
  return [head, TENS[Math.floor((value % 100) / 10)], ONES[value % 10]].filter(Boolean).join(" ")
}

/** "bin iki yüz on beş": a whole number in Turkish words. */
function words(value: number): string {
  if (value === 0) {
    return "sıfır"
  }
  const parts: string[] = []
  let rest = value
  for (const [size, name] of [
    [1e9, "milyar"],
    [1e6, "milyon"],
    [1e3, "bin"],
  ] as const) {
    const group = Math.floor(rest / size)
    if (group > 0) {
      parts.push(size === 1e3 && group === 1 ? "bin" : `${hundreds(group)} ${name}`)
    }
    rest %= size
  }
  return [...parts, hundreds(rest)].filter(Boolean).join(" ")
}

/** "Yalnız: dokuz yüz elli Türk lirası altmış dokuz kuruş" */
export function amountInWords(lira: number): string {
  const kurus = Math.round(lira * 100)
  const tail = kurus % 100 === 0 ? "" : ` ${words(kurus % 100)} kuruş`
  return `Yalnız: ${words(Math.floor(kurus / 100))} Türk lirası${tail}`
}

const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : ""

/** "03-11-2026" from "2026-11-03". */
const dayOf = (iso: string): string => iso.slice(0, 10).split("-").reverse().join("-")

const timeOf = (at: number): string =>
  new Date(at).toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  })

const taxLine = (taxNumber: string): string =>
  `${taxNumber.length === 10 ? "VKN" : "TCKN"}: ${taxNumber}`

export function printoutOf(input: PrintoutInput): Buffer {
  const { company, document, invoice, job } = input
  const contact = input.contact ?? {}
  const archive = document.type === "e_archives"
  const sale = (job?.attributes["internet_sale"] ?? {}) as Record<string, unknown>
  const shipment = job?.attributes["shipment"] as Record<string, unknown> | undefined
  const attributes = invoice.attributes
  const site = text(sale["url"])
  const pick = (name: string, fallback: string) => text(contact[name]) || text(attributes[fallback])
  const place = [pick("district", "district"), pick("city", "city")].filter(Boolean).join(" / ")
  const email = text(contact["email"])
  const phone = text(contact["phone"]) || text(attributes["billing_phone"])
  const taxOffice = pick("tax_office", "tax_office")
  const issueDay = dayOf(text(attributes["issue_date"]) || new Date().toISOString())
  const orderDay = text(attributes["order_date"])
  const lines: InvoiceLine[] = invoice.details.map((line) => ({
    description: text(line["description"]) || "Satış",
    quantity: Number(line["quantity"] ?? 1),
    unitPrice: Number(line["unit_price"] ?? 0),
    discount: line["discount_type"] === "amount" ? Number(line["discount_value"] ?? 0) : 0,
    vatRate: Number(line["vat_rate"] ?? 0),
  }))
  const carrierId = text(shipment?.["vkn"]) || text(shipment?.["tckn"])
  const scenario = archive
    ? "EARSIVFATURA"
    : job?.attributes["scenario"] === "commercial"
      ? "TICARIFATURA"
      : "TEMELFATURA"
  return invoicePdf({
    title: archive ? "e-Arşiv Fatura" : "e-Fatura",
    seller: {
      name: company.title,
      lines: [
        company.address,
        ...(company.phone ? [`Tel: ${company.phone}`] : []),
        ...(company.email ? [`E-Posta: ${company.email}`] : []),
        ...(site ? [`Web Sitesi: ${site}`] : []),
        `Vergi Dairesi: ${company.taxOffice}`,
        taxLine(company.taxNumber),
      ],
    },
    buyer: {
      name: text(contact["name"]) || "Alıcı",
      lines: [
        pick("address", "billing_address"),
        place,
        ...(email ? [`E-Posta: ${email}`] : []),
        ...(phone ? [`Tel: ${phone}`] : []),
        ...(taxOffice ? [`Vergi Dairesi: ${taxOffice}`] : []),
        taxLine(pick("tax_number", "tax_number")),
      ].filter(Boolean),
    },
    facts: [
      ["Özelleştirme No", "TR1.2"],
      ["Senaryo", scenario],
      ["Fatura Tipi", "SATIS"],
      ["Fatura No", text(document.attributes["invoice_number"])],
      ["Fatura Tarihi", `${issueDay} ${timeOf(document.issued_at ?? Date.now())}`],
      ...(text(attributes["order_no"]) ? [["Sipariş No", text(attributes["order_no"])]] : []),
      ...(orderDay ? [["Sipariş Tarihi", dayOf(orderDay)]] : []),
      ...(archive ? [["Gönderim Şekli", "ELEKTRONIK"]] : []),
    ] as [string, string][],
    ettn: text(document.attributes["uuid"]),
    lines,
    notes: [
      amountInWords(Number(totalsOf(invoice.details).gross_total)),
      ...(archive && site
        ? [
            "Bu satış internet üzerinden yapılmıştır.",
            [
              `Web adresi: ${site}`,
              `Ödeme şekli: ${text(sale["payment_type"])}`,
              ...(text(sale["payment_platform"])
                ? [`Ödeme aracısı: ${text(sale["payment_platform"])}`]
                : []),
              ...(text(sale["payment_date"])
                ? [`Ödeme tarihi: ${dayOf(text(sale["payment_date"]))}`]
                : []),
            ].join(" · "),
          ]
        : []),
      ...(shipment
        ? [
            `Gönderiyi taşıyan: ${text(shipment["title"]) || text(shipment["name"])}${carrierId ? ` (${taxLine(carrierId)})` : ""} · Gönderim tarihi: ${dayOf(text(shipment["date"]))}`,
          ]
        : []),
      ...(archive ? ["e-Arşiv izni kapsamında elektronik ortamda iletilmiştir."] : []),
    ],
  })
}
