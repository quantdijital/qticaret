import type { Block } from "../content"
import type { MedusaAmount } from "../money"
import { readableTrPhone } from "../tr/phone"
import { addressLine, joined, legalDateTime, legalDiscount, legalMoney } from "./format"
import type { AddressFacts } from "./format"
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
    /** Its product is a gift card (adr/0025): withdrawn only while its cards are unused. */
    gift_card?: boolean
  } | null)[]
  shipping_address: AddressFacts | null
  billing_address: AddressFacts | null
  payment: ContractPayment | null
}

export const CONTRACT_PAYMENTS = ["card", "bank_transfer", "cash_on_delivery"] as const
export type ContractPayment = (typeof CONTRACT_PAYMENTS)[number]

export interface OrderLegalValues {
  text: Record<OrderToken, string>
  blocks: Record<string, Block[]>
}

const PAYMENTS: Readonly<Record<ContractPayment, string>> = {
  card: "Kredi kartı / banka kartı",
  bank_transfer: "Havale / EFT",
  cash_on_delivery: "Kapıda ödeme",
}

const nameOf = (address: AddressFacts | null): string =>
  joined([address?.first_name, address?.last_name], " ")

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
 * the way it is paid, and the lines made to the buyer's wish (adr/0052 §8)
 * or sold as gift cards (adr/0025).
 */
export function orderLegalValues(order: OrderContractFacts): OrderLegalValues {
  const delivery = addressLine(order.shipping_address)
  const billing = addressLine(order.billing_address)
  const lines = order.items.flatMap((item) =>
    item
      ? [
          {
            title: joined([item.product_title ?? item.title, item.variant_title], " · "),
            quantity: Number(item.quantity),
            total: legalMoney(item.total),
            metadata: item.metadata,
            gift_card: item.gift_card === true,
          },
        ]
      : []
  )
  return {
    text: {
      alıcı_adı: nameOf(order.shipping_address) || nameOf(order.billing_address),
      alıcı_e_posta: order.email?.trim() ?? "",
      alıcı_telefon:
        readableTrPhone(order.shipping_address?.phone) ??
        readableTrPhone(order.billing_address?.phone) ??
        "",
      teslimat_adresi: delivery,
      fatura_adresi: billing || delivery,
      sipariş_no: order.display_id === null ? "" : `#${String(order.display_id)}`,
      sipariş_tarihi: order.created_at === null ? "" : legalDateTime(new Date(order.created_at)),
      sipariş_kalemleri: "",
      ara_toplam: legalMoney(order.item_total),
      kargo_ücreti: legalMoney(order.shipping_total),
      indirim: legalDiscount(order.discount_total),
      toplam: legalMoney(order.total),
      ödeme_yöntemi: order.payment ? PAYMENTS[order.payment] : "",
    },
    blocks: {
      sipariş_kalemleri: [linesTable(lines)],
      [PERSONAL_LINES_TOKEN]: personalLinesBlocks(lines),
    },
  }
}
