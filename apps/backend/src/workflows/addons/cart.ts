import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import { fromMedusaAmount } from "../../lib/money"
import type { Kurus, MedusaAmount } from "../../lib/money"

/** Every product's effective add-ons, own and templates' (adr/0052 Ek 2026-11-23). */
export { productAddonsAmong } from "./effective"

type Container = Pick<MedusaContainer, "resolve">

/** A cart line as the add-on rules read it. */
export interface AddonCartLine {
  id: string
  variant_id?: string | null
  product_id?: string | null
  quantity: MedusaAmount
  unit_price: MedusaAmount
  is_custom_price?: boolean | null
  is_tax_inclusive?: boolean | null
  metadata?: Record<string, unknown> | null
}

export interface AddonCart {
  id: string
  completed_at?: unknown
  sales_channel_id?: string | null
  currency_code: string
  region_id?: string | null
  customer_id?: string | null
  customer?: { id: string; groups?: ({ id: string } | null)[] | null } | null
  items?: (AddonCartLine | null)[] | null
}

const CART_FIELDS = [
  "id",
  "completed_at",
  "sales_channel_id",
  "currency_code",
  "region_id",
  "customer_id",
  "customer.id",
  "customer.groups.id",
  ...[
    "id",
    "variant_id",
    "product_id",
    "quantity",
    "unit_price",
    "is_custom_price",
    "is_tax_inclusive",
    "metadata",
  ].map((field) => `items.${field}`),
]

export async function readAddonCart(
  container: Container,
  cartId: string
): Promise<AddonCart | undefined> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: CART_FIELDS,
    filters: { id: cartId },
  })
  return (data as AddonCart[])[0]
}

/**
 * A price for Medusa's line update, whose type wants one: null clears a
 * sale's price left from before (the column is nullable).
 */
export const clearablePrice = (value: string | null): string => value as unknown as string

export const linesOf = (cart: AddonCart): AddonCartLine[] =>
  (cart.items ?? []).flatMap((item) => (item ? [item] : []))

export const quantityOf = (line: AddonCartLine): number => Number(line.quantity)

export interface VariantPrice {
  /** What the cart would charge for the variant now, per unit. */
  calculated: Kurus
  /** The price before a sale list, when it is higher; null otherwise. */
  original: Kurus | null
  /** Whether the price list gives it with tax in (the store's currency or region setting). */
  tax_inclusive: boolean
}

interface VariantRow {
  calculated_price?: {
    calculated_amount?: MedusaAmount | null
    original_amount?: MedusaAmount | null
    is_calculated_price_tax_inclusive?: boolean | null
  } | null
}

/**
 * The variant's price in the cart's pricing context, as Medusa prices a
 * line (2.21.2): the cart's currency and region, its customer and their
 * groups (a group's price list), and the line's quantity (tiered
 * prices). Null when the variant has no price there.
 */
export async function variantPrice(
  container: Container,
  cart: AddonCart,
  variantId: string,
  quantity: number
): Promise<VariantPrice | null> {
  const groups = (cart.customer?.groups ?? []).flatMap((group) => (group ? [group.id] : []))
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: [
      "id",
      "calculated_price.calculated_amount",
      "calculated_price.original_amount",
      "calculated_price.is_calculated_price_tax_inclusive",
    ],
    filters: { id: variantId },
    context: {
      calculated_price: QueryContext({
        currency_code: cart.currency_code,
        ...(cart.region_id ? { region_id: cart.region_id } : {}),
        ...(cart.customer_id
          ? {
              customer_id: cart.customer_id,
              customer: { id: cart.customer_id, groups: { id: groups } },
            }
          : {}),
        quantity,
      }),
    },
  })
  const price = (data[0] as VariantRow | undefined)?.calculated_price
  if (price?.calculated_amount === null || price?.calculated_amount === undefined) {
    return null
  }
  const calculated = fromMedusaAmount(price.calculated_amount, { allowRounding: true })
  const original =
    price.original_amount === null || price.original_amount === undefined
      ? null
      : fromMedusaAmount(price.original_amount, { allowRounding: true })
  return {
    calculated,
    original: original !== null && original > calculated ? original : null,
    tax_inclusive: price.is_calculated_price_tax_inclusive === true,
  }
}
