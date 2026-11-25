import { MathBN } from "@medusajs/framework/utils"
import { lineAddonsOf } from "../catalog/addons"
import { fromMedusaAmount, toMedusaAmount } from "../money"
import type { MedusaAmount } from "../money"
import { giftRecipientOf } from "../promotions/gift-sale"
import { orderNoteOf } from "./customer-note"
import { lineMetadataOf } from "./line-metadata"
import type { LineMetadataRow } from "./line-metadata"
import { paymentMethodOf } from "./payment-method"
import type { PaymentMethod, PaymentMethodOrder } from "./payment-method"

/**
 * What a packing slip and a pick list print of an order: who it goes to,
 * what goes in the box with each line's add-on picks in full as they are to
 * be made (adr/0052 §9), a gift's recipient and note, how it was paid, and
 * prices only when the shop asks for them (`shipping.packing_slip_prices`).
 */

type Rows<T> = (T | null)[] | null | undefined

export interface PackingItemRow extends LineMetadataRow {
  id: string
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
  variant_sku?: string | null
  quantity?: MedusaAmount | null
  unit_price?: MedusaAmount | null
  total?: MedusaAmount | null
  requires_shipping?: boolean | null
}

export interface PackingAddressRow {
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  phone?: string | null
}

export interface PackingOrderRow extends PaymentMethodOrder {
  id: string
  display_id: number | string
  created_at: string | Date
  currency_code: string
  email?: string | null
  items?: Rows<PackingItemRow>
  shipping_address?: PackingAddressRow | null
  original_item_total?: MedusaAmount | null
  original_shipping_total?: MedusaAmount | null
  discount_total?: MedusaAmount | null
  total?: MedusaAmount | null
}

export interface PackingAddon {
  label: string
  /** The typed text or the chosen option, in full. */
  value: string
  kind: "text" | "choice"
}

export interface PackingItem {
  id: string
  title: string
  variant: string | null
  sku: string | null
  quantity: number
  /** A line that goes in no box (a gift card, a digital product). */
  ships: boolean
  addons: PackingAddon[]
  non_withdrawable: boolean
  gift: { recipient: string; message: string | null; sender: string | null } | null
  unit_price: string | null
  total: string | null
}

export interface PackingExtras {
  prices: boolean
  delivery: { name: string; carrier: string | null } | null
  tracking_number: string | null
  notes: string[]
}

const amount = (value: MedusaAmount | null | undefined): string =>
  toMedusaAmount(fromMedusaAmount(value ?? 0, { allowRounding: true }))

const present = <T>(rows: Rows<T>): T[] => (rows ?? []).filter((row): row is T => row !== null)

/** A line's add-on picks as the slip prints them: the add-on's name and what was picked. */
export function packingAddonsOf(metadata: unknown): {
  addons: PackingAddon[]
  non_withdrawable: boolean
} {
  const addons = lineAddonsOf(metadata)
  return {
    addons: (addons?.items ?? []).map((item) => ({
      label: item.label,
      value: (item.kind === "choice" ? item.choice_label : item.value) ?? "",
      kind: item.kind,
    })),
    non_withdrawable: addons?.non_withdrawable ?? false,
  }
}

function itemOf(item: PackingItemRow, prices: boolean): PackingItem {
  const metadata = lineMetadataOf(item)
  const gift = giftRecipientOf(metadata)
  const product = item.product_title ?? item.title ?? ""
  const variant = item.variant_title && item.variant_title !== "Default" ? item.variant_title : null
  return {
    id: item.id,
    title: product,
    variant,
    sku: item.variant_sku ?? null,
    quantity: MathBN.convert(item.quantity ?? 0).toNumber(),
    ships: item.requires_shipping !== false,
    ...packingAddonsOf(metadata),
    gift: gift
      ? {
          recipient: gift.recipient_name ?? gift.recipient_email,
          message: gift.message,
          sender: gift.sender_name,
        }
      : null,
    unit_price: prices ? amount(item.unit_price) : null,
    total: prices ? amount(item.total) : null,
  }
}

// An address field left empty prints as nothing
const filled = (value: string | null | undefined): string | null =>
  value && value.trim() !== "" ? value : null

/** The order as its packing slip prints it. */
export function packingOrderOf(order: PackingOrderRow, extras: PackingExtras) {
  const address = order.shipping_address
  return {
    id: order.id,
    display_id: Number(order.display_id),
    created_at: new Date(order.created_at).toISOString(),
    currency_code: order.currency_code,
    email: order.email ?? null,
    shipping_address: address
      ? {
          name: filled([address.first_name, address.last_name].filter(Boolean).join(" ")),
          company: filled(address.company),
          address_1: filled(address.address_1),
          address_2: filled(address.address_2),
          district: filled(address.city),
          city: filled(address.province),
          postal_code: filled(address.postal_code),
          phone: filled(address.phone),
        }
      : null,
    payment_method: paymentMethodOf(order) satisfies PaymentMethod,
    delivery: extras.delivery,
    tracking_number: extras.tracking_number,
    items: present(order.items).map((item) => itemOf(item, extras.prices)),
    notes: extras.notes,
    // The shopper's own words at checkout (Batch 8 / O1), printed for whoever packs
    customer_note: orderNoteOf(order.metadata),
    totals: extras.prices
      ? {
          items: amount(order.original_item_total),
          shipping: amount(order.original_shipping_total),
          discount: amount(order.discount_total),
          total: amount(order.total),
        }
      : null,
  }
}

export type PackingOrder = ReturnType<typeof packingOrderOf>
