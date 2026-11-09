import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, getVariantAvailability } from "@medusajs/framework/utils"
import { stockShortfall } from "../../lib/stock"
import type { CartStockLine, StockShortLine } from "../../lib/stock"

type Container = Pick<MedusaContainer, "resolve">

interface CartRow {
  sales_channel_id?: string | null
  completed_at?: string | Date | null
  items?:
    | ({
        variant_id?: string | null
        // A number, or its text from a raw column
        quantity?: number | string | null
        title?: string | null
        product_title?: string | null
        variant_title?: string | null
        variant_sku?: string | null
        variant?: { manage_inventory?: boolean | null; allow_backorder?: boolean | null } | null
      } | null)[]
    | null
}

export interface CartStock {
  sales_channel_id: string | null
  completed: boolean
  /** Variants that are tracked and not sold past the shelf. */
  tracked: string[]
  /** Those with fewer units for sale than the cart asks for. */
  short: StockShortLine[]
}

/** "Chuby / Kahverengi": a line as the shop names it. */
const titleOf = (item: NonNullable<NonNullable<CartRow["items"]>[number]>) =>
  [item.product_title ?? item.title, item.variant_title]
    .filter((part): part is string => Boolean(part))
    .join(" / ") || "—"

/**
 * The cart's lines against the shelf, as Medusa counts what is for sale
 * (`getVariantAvailability`: stocked − reserved over the sales channel's
 * locations, the same count its add-to-cart check uses). A variant that is
 * not tracked or sells past the shelf is never short.
 */
export async function readCartStock(container: Container, cartId: string): Promise<CartStock> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "sales_channel_id",
      "completed_at",
      "items.variant_id",
      "items.quantity",
      "items.title",
      "items.product_title",
      "items.variant_title",
      "items.variant_sku",
      "items.variant.manage_inventory",
      "items.variant.allow_backorder",
    ],
    filters: { id: cartId },
  })
  const cart = (data[0] ?? {}) as CartRow
  const lines: CartStockLine[] = (cart.items ?? []).flatMap((item) =>
    item
      ? [
          {
            variant_id: item.variant_id ?? null,
            quantity: Number(item.quantity ?? 0),
            title: titleOf(item),
            sku: item.variant_sku ?? null,
            tracked: Boolean(item.variant?.manage_inventory && !item.variant.allow_backorder),
          },
        ]
      : []
  )
  const tracked = [
    ...new Set(lines.flatMap((line) => (line.tracked && line.variant_id ? [line.variant_id] : []))),
  ]
  const salesChannelId = cart.sales_channel_id ?? null
  const base = { sales_channel_id: salesChannelId, completed: Boolean(cart.completed_at), tracked }
  if (tracked.length === 0 || !salesChannelId) {
    return { ...base, short: [] }
  }
  const availability = await getVariantAvailability(query, {
    variant_ids: tracked,
    sales_channel_id: salesChannelId,
  })
  const available = Object.fromEntries(
    tracked.map((id) => [id, availability[id]?.availability ?? 0])
  )
  return { ...base, short: stockShortfall(lines, available) }
}
