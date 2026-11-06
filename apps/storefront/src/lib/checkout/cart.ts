import "server-only"
import { cartIdFromCookie } from "../cart/cookie"
import { isNotFound } from "../store-api/errors"
import { storeGet } from "../store-api/server"

export interface CheckoutAddress {
  first_name: string | null
  last_name: string | null
  phone: string | null
  address_1: string | null
  address_2: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  country_code: string | null
}

export interface CheckoutCartLine {
  id: string
  /** For the conversion events (docs/20): the item's id and name as the server events give them. */
  variant_id?: string | null
  product_title?: string | null
  unit_price?: number | null
  /** The line's product, for its page in the summary (`productPathsOf`). */
  product_id?: string | null
  title: string
  subtitle: string | null
  variant_title: string | null
  thumbnail: string | null
  quantity: number
  total: number
  /** The server's records on the line: its add-on picks (`qt_addons`, adr/0052). */
  metadata?: Record<string, unknown> | null
}

export interface CheckoutCart {
  id: string
  email: string | null
  completed_at: string | null
  shipping_address: CheckoutAddress | null
  shipping_methods: { id: string; shipping_option_id: string | null; name: string; total: number }[]
  items: CheckoutCartLine[]
  original_item_total: number
  item_total: number
  shipping_total: number
  /** What gift cards and store credit take off (F4.8); `total` is after it. */
  credit_line_total?: number | null
  total: number
  /** The server's records on the cart: a payment link's mark (`qt_payment_link`, adr/0051). */
  metadata?: Record<string, unknown> | null
  /** The codes on the cart (automatic campaigns have none to show). */
  promotions?: { code: string | null; is_automatic?: boolean | null }[] | null
}

const ADDRESS = [
  "first_name",
  "last_name",
  "phone",
  "address_1",
  "address_2",
  "city",
  "province",
  "postal_code",
  "country_code",
]

const FIELDS = [
  "id",
  "email",
  "completed_at",
  "metadata",
  ...ADDRESS.map((field) => `shipping_address.${field}`),
  "shipping_methods.id",
  "shipping_methods.shipping_option_id",
  "shipping_methods.name",
  "shipping_methods.total",
  "items.id",
  "items.variant_id",
  "items.product_id",
  "items.product_title",
  "items.unit_price",
  "items.title",
  "items.subtitle",
  "items.variant_title",
  "items.thumbnail",
  "items.quantity",
  "items.total",
  "items.metadata",
  "original_item_total",
  "item_total",
  "shipping_total",
  "credit_line_total",
  "total",
  "promotions.code",
  "promotions.is_automatic",
].join(",")

/** The shopper's open cart with what checkout needs; null when there is none to pay. */
export async function checkoutCart(): Promise<CheckoutCart | null> {
  const id = await cartIdFromCookie()
  if (!id) {
    return null
  }
  try {
    const { cart } = await storeGet<{ cart: CheckoutCart }>(`/store/carts/${id}`, {
      fields: FIELDS,
    })
    return cart.completed_at ? null : cart
  } catch (error) {
    if (isNotFound(error)) {
      return null
    }
    throw error
  }
}

/** Every field the address step asks for is on the cart. */
export function addressComplete(cart: CheckoutCart): boolean {
  const address = cart.shipping_address
  return Boolean(
    cart.email &&
    address?.first_name &&
    address.last_name &&
    address.phone &&
    address.address_1 &&
    address.address_2 &&
    address.city &&
    address.province
  )
}
