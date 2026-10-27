import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { checkoutProblem } from "../../../lib/checkout"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { itemAmounts, lineShares, shippingAmounts } from "../../../lib/orders"
import type { LineShare } from "../../../lib/orders"
import type { HostedCheckout } from "../../../lib/payments/checkout"
import {
  CART_LINE_FIELDS,
  itemFacts,
  itemName,
  present,
  shippingFacts,
  shippingName,
} from "../cart-lines"
import type { CartItemRow, CartShippingRow } from "../cart-lines"

export interface CheckoutCartInput {
  cart_id: string
  /** The publishable key's channels: a cart of another channel is not this storefront's. */
  sales_channel_ids: string[]
}

export interface CheckoutCart {
  payment_collection_id: string | null
  email: string
  buyer: HostedCheckout["buyer"]
  lines: (Pick<LineShare, "id" | "kind" | "quantity" | "net"> & { name: string })[]
}

const ADDRESS_FIELDS = [
  "first_name",
  "last_name",
  "phone",
  "address_1",
  "address_2",
  "city",
  "province",
  "postal_code",
  "country_code",
] as const

type AddressRow = Partial<Record<(typeof ADDRESS_FIELDS)[number], string | null>>

interface CartRow {
  id: string
  email?: string | null
  completed_at?: string | Date | null
  sales_channel_id?: string | null
  shipping_address?: AddressRow | null
  billing_address?: AddressRow | null
  items?: (CartItemRow | null)[] | null
  shipping_methods?: (CartShippingRow | null)[] | null
  payment_collection?: { id: string } | null
}

/**
 * The cart a payment starts from, read on the server (adr/0026 §1): its
 * lines' shares in kuruş, the buyer from the shipping address (the
 * billing address when it has no phone), and its payment collection.
 * A cart that is not ready says what it misses, field by field.
 */
export const readCheckoutCartStep = createStep(
  "payments-read-checkout-cart",
  async (input: CheckoutCartInput, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: [
        "id",
        "email",
        "completed_at",
        "sales_channel_id",
        ...ADDRESS_FIELDS.map((field) => `shipping_address.${field}`),
        ...ADDRESS_FIELDS.map((field) => `billing_address.${field}`),
        ...CART_LINE_FIELDS,
        "payment_collection.id",
      ],
      filters: { id: input.cart_id },
    })
    const cart = data[0] as CartRow | undefined
    if (!cart || !input.sales_channel_ids.includes(cart.sales_channel_id ?? "")) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "cart.unknown")
    }
    if (cart.completed_at) {
      throw new ConflictError("cart.completed")
    }
    const items = present(cart.items)
    const shipping = present(cart.shipping_methods)
    if (items.length === 0) {
      throw new ValidationError("cart.empty", { field: "items" })
    }
    const problem = checkoutProblem(cart)
    if (problem) {
      throw new ValidationError(problem.key, { field: problem.field })
    }
    if (items.some((item) => item.requires_shipping !== false) && shipping.length === 0) {
      throw new ValidationError("cart.shipping_method_required", { field: "shipping_methods" })
    }
    if (!cart.email) {
      throw new ValidationError("cart.email_required", { field: "email" })
    }
    const address = cart.shipping_address ?? {}
    const phone = address.phone ?? cart.billing_address?.phone
    if (!phone) {
      throw new ValidationError("cart.phone_required", { field: "shipping_address.phone" })
    }

    const names = new Map([
      ...items.map((item) => [item.id, itemName(item)] as const),
      ...shipping.map((method) => [method.id, shippingName(method)] as const),
    ])
    const shares = lineShares([
      ...items.map((item) => itemAmounts(itemFacts(item))),
      ...shipping.map((method) => shippingAmounts(shippingFacts(method))),
    ])
    const result: CheckoutCart = {
      payment_collection_id: cart.payment_collection?.id ?? null,
      email: cart.email,
      buyer: {
        first_name: address.first_name ?? "",
        last_name: address.last_name ?? "",
        phone,
        address_1: address.address_1 ?? "",
        address_2: address.address_2 ?? null,
        city: address.city ?? "",
        province: address.province ?? null,
        postal_code: address.postal_code ?? null,
        country_code: address.country_code ?? "",
      },
      lines: shares.map((share) => ({
        id: share.id,
        kind: share.kind,
        quantity: share.quantity,
        net: share.net,
        name: names.get(share.id) ?? share.id,
      })),
    }
    return new StepResponse(result)
  }
)
