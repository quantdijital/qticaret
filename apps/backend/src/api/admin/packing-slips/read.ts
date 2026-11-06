import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PAYMENT_METHOD_FIELDS } from "../../../lib/orders/payment-method"
import { packingOrderOf } from "../../../lib/orders/packing"
import type { PackingOrderRow } from "../../../lib/orders/packing"
import { ORDER_NOTES_MODULE } from "../../../modules/order-notes"
import type OrderNotesModuleService from "../../../modules/order-notes/service"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import type {
  AppearanceSettings,
  LegalSettings,
  ShippingSettings,
  StoreSettings,
} from "../../../modules/platform-settings/sections"
import { deliveriesOf, shippingOf } from "../order-board/parcels"
import type { DeliveryOrder } from "../order-board/parcels"

const ORDER_FIELDS = [
  "id",
  "display_id",
  "created_at",
  "currency_code",
  "email",
  "original_item_total",
  "original_shipping_total",
  "discount_total",
  "total",
  "items.id",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.variant_sku",
  "items.quantity",
  // Medusa fills an item's quantity only with its detail (or the totals) requested
  "items.detail.quantity",
  "items.unit_price",
  "items.total",
  "items.requires_shipping",
  "items.metadata",
  "items.line_item_metadata",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.company",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.postal_code",
  "shipping_address.phone",
  "shipping_methods.name",
  "shipping_methods.shipping_option_id",
  ...PAYMENT_METHOD_FIELDS,
]

/** Who the slip comes from: the shop's name, its logo and how it is reached (adr/0048). */
async function shopOf(scope: MedusaContainer) {
  const settings = scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [appearance, store, legal, shipping, { data: stores }] = await Promise.all([
    settings.getSection("appearance") as Promise<unknown> as Promise<AppearanceSettings>,
    settings.getSection("store") as Promise<unknown> as Promise<StoreSettings>,
    settings.getSection("legal") as Promise<unknown> as Promise<LegalSettings>,
    settings.getSection("shipping") as Promise<unknown> as Promise<ShippingSettings>,
    scope
      .resolve(ContainerRegistrationKeys.QUERY)
      .graph({ entity: "store", fields: ["name"], pagination: { take: 1 } }),
  ])
  const name = (stores[0] as { name?: string } | undefined)?.name?.trim() ?? ""
  return {
    shop: {
      name: name === "" ? null : name,
      // The light logo: the slip is printed on white paper
      logo_url: appearance.logo_light_url,
      company_title: legal.company_title,
      address: legal.address,
      email: store.contact_email,
      phone: store.contact_phone,
    },
    prices: shipping.packing_slip_prices,
  }
}

/** The orders' standing team notes, oldest first: the pick list's, and a slip's when asked. */
async function notesOf(scope: MedusaContainer, orderIds: string[]) {
  const rows = await scope
    .resolve<OrderNotesModuleService>(ORDER_NOTES_MODULE)
    .listOrderNotes(
      { order_id: orderIds, removed_by: null },
      { select: ["order_id", "body"], order: { created_at: "ASC" } }
    )
  const byOrder = new Map<string, string[]>()
  for (const row of rows) {
    byOrder.set(row.order_id, [...(byOrder.get(row.order_id) ?? []), row.body])
  }
  return byOrder
}

/**
 * The picked orders as their packing slips and the pick list print them
 * (`lib/orders/packing.ts`), in the order asked; an id that is no order is
 * left out. A recorded read: addresses and names (SENSITIVE_READS).
 */
export async function readPackingSlips(scope: MedusaContainer, ids: string[]) {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: ids, is_draft_order: false },
  })
  const rows = data as unknown as (PackingOrderRow & DeliveryOrder)[]
  const [{ shop, prices }, deliveries, parcels, notes] = await Promise.all([
    shopOf(scope),
    deliveriesOf(scope, rows),
    shippingOf(
      scope,
      rows.map((row) => row.id)
    ),
    notesOf(
      scope,
      rows.map((row) => row.id)
    ),
  ])
  const byId = new Map(rows.map((row) => [row.id, row]))
  return {
    shop,
    prices,
    orders: ids.flatMap((id) => {
      const row = byId.get(id)
      if (!row) {
        return []
      }
      const delivery = deliveries.get(id)
      return [
        packingOrderOf(row, {
          prices,
          delivery: delivery ? { name: delivery.name, carrier: delivery.carrier } : null,
          tracking_number: parcels.get(id)?.tracking_number ?? null,
          notes: notes.get(id) ?? [],
        }),
      ]
    }),
  }
}

export type PackingSlips = Awaited<ReturnType<typeof readPackingSlips>>
