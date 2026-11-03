import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ContentDoc } from "../../lib/content"
import { orderLegalValues, withPersonalLines } from "../../lib/legal"
import type { ContractPayment, OrderContractFacts } from "../../lib/legal"
import {
  BANK_TRANSFER_PAYMENT_PROVIDER_ID,
  COD_PAYMENT_PROVIDER_ID,
} from "../../lib/payments/checkout"
import { giftProductsAmong } from "../gift-cards/gift-marks"
import { renderLegal } from "./read"

type Container = Pick<MedusaContainer, "resolve">

const ADDRESS = [
  "first_name",
  "last_name",
  "company",
  "address_1",
  "address_2",
  "city",
  "province",
  "postal_code",
  "phone",
]

/** What a contract reads of an order or a cart (F13.2). */
const CONTRACT_FIELDS = [
  "email",
  "item_total",
  "shipping_total",
  "discount_total",
  "total",
  "items.product_title",
  "items.title",
  "items.variant_title",
  "items.quantity",
  "items.total",
  // A line's add-on record: a pick made to the buyer's wish (adr/0052 §8)
  "items.metadata",
  // A gift card's product: withdrawn only while its cards are unused (adr/0025)
  "items.product_id",
  ...ADDRESS.map((field) => `shipping_address.${field}`),
  ...ADDRESS.map((field) => `billing_address.${field}`),
]

type SessionRow = { provider_id?: string | null; status?: string | null } | null

/**
 * The way an order is paid, from its payment's provider: a card unless
 * offline; none when nothing was paid through one (a gift card in full).
 */
function paymentOf(sessions: SessionRow[]): ContractPayment | null {
  const providers = sessions.flatMap((session) =>
    session?.provider_id ? [session.provider_id] : []
  )
  if (providers.length === 0) {
    return null
  }
  if (providers.includes(BANK_TRANSFER_PAYMENT_PROVIDER_ID)) {
    return "bank_transfer"
  }
  return providers.includes(COD_PAYMENT_PROVIDER_ID) ? "cash_on_delivery" : "card"
}

type ItemRow = NonNullable<OrderContractFacts["items"][number]> & { product_id?: string | null }

/** The lines, each gift card's marked (its product's mark, adr/0025). */
async function markedItems(
  container: Container,
  items: readonly (ItemRow | null)[]
): Promise<OrderContractFacts["items"]> {
  const gifts = await giftProductsAmong(
    container,
    items.map((item) => item?.product_id)
  )
  return items.map((item) =>
    item ? { ...item, gift_card: Boolean(item.product_id && gifts.has(item.product_id)) } : item
  )
}

type Row = Omit<OrderContractFacts, "display_id" | "created_at" | "payment" | "items"> & {
  items: (ItemRow | null)[]
  id: string
  display_id?: number
  created_at?: string | Date
  cart?: { id: string } | null
  payment_collections?: ({ payment_sessions?: SessionRow[] | null } | null)[] | null
}

/** The order as its contracts read it, and the cart it was, whose consent it carries. */
export async function orderContract(container: Container, orderId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "created_at",
      "cart.id",
      "payment_collections.payment_sessions.provider_id",
      ...CONTRACT_FIELDS,
    ],
    filters: { id: orderId },
  })
  const row = data[0] as Row | undefined
  if (!row) {
    return null
  }
  const sessions = (row.payment_collections ?? []).flatMap(
    (collection) => collection?.payment_sessions ?? []
  )
  return {
    cart_id: row.cart?.id ?? null,
    facts: {
      ...row,
      items: await markedItems(container, row.items),
      display_id: row.display_id ?? null,
      created_at: row.created_at ?? null,
      payment: paymentOf(sessions),
    } satisfies OrderContractFacts,
  }
}

/**
 * The cart as its contracts read it before checkout: the way to pay as
 * the shopper chose it on the page, for the text only (the order's copy
 * takes it from the payment).
 */
export async function cartContract(
  container: Container,
  cartId: string,
  payment: ContractPayment | null
) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "completed_at", "sales_channel_id", ...CONTRACT_FIELDS],
    filters: { id: cartId },
  })
  const row = data[0] as
    (Row & { completed_at?: unknown; sales_channel_id?: string | null }) | undefined
  if (!row) {
    return null
  }
  return {
    completed: Boolean(row.completed_at),
    sales_channel_id: row.sales_channel_id ?? null,
    facts: {
      ...row,
      items: await markedItems(container, row.items),
      display_id: null,
      created_at: null,
      payment,
    } satisfies OrderContractFacts,
  }
}

/**
 * A contract's text filled with the shop's details and the order's (or the
 * cart's); its withdrawal clause names the lines made to the buyer's wish
 * and the gift cards.
 */
export async function renderContract(
  container: Container,
  body: unknown,
  facts: OrderContractFacts
): Promise<string> {
  const values = orderLegalValues(facts)
  return renderLegal(container, withPersonalLines(body as ContentDoc, values.blocks), values)
}
