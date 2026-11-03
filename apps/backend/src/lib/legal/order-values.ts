import type { Block } from "../content"
import { fromMedusaAmount } from "../money"
import type { MedusaAmount } from "../money"
import { PERSONAL_LINES_TOKEN } from "./tokens"
import type { OrderToken } from "./tokens"
import { personalLinesBlocks } from "./withdrawal"

/**
 * An order as its contracts read it (F13.2): what was bought, by whom, for
 * how much. A cart reads the same before it is one: no number or date yet,
 * and the way to pay only once the shopper chose it.
 */
export interface OrderContractFacts {
  display_id: number | null
  created_at: string | Date | null
  email: string | null
  item_total: MedusaAmount
  shipping_total: MedusaAmount
  discount_total: MedusaAmount
  total: MedusaAmount
  items: ({
    product_title?: string | null
    title?: string | null
    variant_title?: string | null
    quantity: MedusaAmount
    total: MedusaAmount
    /** Its add-on record (adr/0052): a pick can make it the buyer's own. */
    metadata?: unknown
  } | null)[]
  shipping_address: AddressFacts | null
  billing_address: AddressFacts | null
  payment: ContractPayment | null
}

export const CONTRACT_PAYMENTS = ["card", "bank_transfer", "cash_on_delivery"] as const
export type ContractPayment = (typeof CONTRACT_PAYMENTS)[number]

type AddressFacts = Partial<
  Record<
    | "first_name"
    | "last_name"
    | "company"
    | "address_1"
    | "address_2"
    | "city"
    | "province"
    | "postal_code"
    | "phone",
    string | null
  >
>

export interface OrderLegalValues {
  text: Record<OrderToken, string>
  blocks: Record<string, Block[]>
}

const PAYMENTS: Readonly<Record<ContractPayment, string>> = {
  card: "Kredi kartı / banka kartı",
  bank_transfer: "Havale / EFT",
  cash_on_delivery: "Kapıda ödeme",
}

const DATE = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "short",
  timeStyle: "short",
})

/** Lira as a Turkish shopper reads it: `₺1.234,50`. */
const lira = (amount: MedusaAmount): string =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
    fromMedusaAmount(amount, { allowRounding: true }) / 100
  )

const joined = (parts: (string | null | undefined)[], separator: string): string =>
  parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(separator)

const nameOf = (address: AddressFacts | null): string =>
  joined([address?.first_name, address?.last_name], " ")

/** One line: street, district, city, postal code. */
function addressText(address: AddressFacts | null): string {
  if (!address) {
    return ""
  }
  return joined(
    [
      address.company,
      joined([address.address_2, address.address_1], ", "),
      joined([address.city, address.province], " / "),
      address.postal_code,
    ],
    ", "
  )
}

const cell = (text: string, header = false) => ({
  type: header ? ("tableHeader" as const) : ("tableCell" as const),
  content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text }] }],
})

/** The order's lines as a table: what, how many, the line's total. */
export function linesTable(
  lines: readonly { title: string; quantity: number; total: string }[]
): Block {
  return {
    type: "table",
    content: [
      { type: "tableRow", content: [cell("Ürün", true), cell("Adet", true), cell("Tutar", true)] },
      ...lines.map((line) => ({
        type: "tableRow" as const,
        content: [cell(line.title), cell(String(line.quantity)), cell(line.total)],
      })),
    ],
  }
}

/**
 * The order's values for its contracts' tokens (adr/0041 §2), as the
 * order holds them when placed: the buyer, the addresses (the billing
 * one is the delivery one when none was given), the lines and totals,
 * the way it is paid, and the lines made to the buyer's wish (adr/0052 §8).
 */
export function orderLegalValues(order: OrderContractFacts): OrderLegalValues {
  const delivery = addressText(order.shipping_address)
  const billing = addressText(order.billing_address)
  const discount = fromMedusaAmount(order.discount_total, { allowRounding: true })
  const lines = order.items.flatMap((item) =>
    item
      ? [
          {
            title: joined([item.product_title ?? item.title, item.variant_title], " · "),
            quantity: Number(item.quantity),
            total: lira(item.total),
            metadata: item.metadata,
          },
        ]
      : []
  )
  return {
    text: {
      alıcı_adı: nameOf(order.shipping_address) || nameOf(order.billing_address),
      alıcı_e_posta: order.email ?? "",
      alıcı_telefon: order.shipping_address?.phone ?? order.billing_address?.phone ?? "",
      teslimat_adresi: delivery,
      fatura_adresi: billing || delivery,
      sipariş_no: order.display_id === null ? "" : `#${String(order.display_id)}`,
      sipariş_tarihi: order.created_at === null ? "" : DATE.format(new Date(order.created_at)),
      sipariş_kalemleri: "",
      ara_toplam: lira(order.item_total),
      kargo_ücreti: lira(order.shipping_total),
      indirim: discount > 0 ? `-${lira(order.discount_total)}` : lira(0),
      toplam: lira(order.total),
      ödeme_yöntemi: order.payment ? PAYMENTS[order.payment] : "",
    },
    blocks: {
      sipariş_kalemleri: [linesTable(lines)],
      [PERSONAL_LINES_TOKEN]: personalLinesBlocks(lines),
    },
  }
}
