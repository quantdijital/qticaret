import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { OrderVars } from "../../../lib/messaging/templates"
import { fromMedusaAmount } from "../../../lib/money"
import type { MedusaAmount } from "../../../lib/money"
import { transferDeadline } from "../../../lib/payments/bank-transfer"
import {
  BANK_TRANSFER_PAYMENT_PROVIDER_ID,
  COD_PAYMENT_PROVIDER_ID,
} from "../../../lib/payments/checkout"
import { formatIban } from "../../../lib/tr/iban"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import type { StoreSettings } from "../../../modules/platform-settings/sections"
import { GREETING, firstText } from "./types"
import type { Loaded } from "./types"

const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "customer_id",
  "created_at",
  "item_total",
  "shipping_total",
  "discount_total",
  "total",
  "items.product_title",
  "items.title",
  "items.variant_title",
  "items.quantity",
  "items.total",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.phone",
  "payment_collections.payment_sessions.provider_id",
  "payment_collections.payment_sessions.data",
]

interface OrderRow {
  id: string
  display_id: number
  email: string | null
  customer_id: string | null
  created_at: string | Date
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
  } | null)[]
  shipping_address: Record<string, string | null | undefined> | null
  payment_collections:
    | ({
        payment_sessions?:
          ({ provider_id: string; data?: Record<string, unknown> | null } | null)[] | null
      } | null)[]
    | null
}

/** Lira as a Turkish shopper reads it: `₺1.234,50`. */
export const lira = (amount: MedusaAmount): string =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
    fromMedusaAmount(amount, { allowRounding: true }) / 100
  )

const filled = (value: string | null | undefined): string => (value ?? "").trim()

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/** The order as its messages show it, and where they go; null when it is gone. */
export async function loadOrderMessage(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string
): Promise<Loaded<OrderVars> | null> {
  const { data } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity: "order", fields: ORDER_FIELDS, filters: { id: orderId } })
  const order = data[0] as OrderRow | undefined
  if (!order) {
    return null
  }
  const sessions = (order.payment_collections ?? []).flatMap(
    (collection) => collection?.payment_sessions ?? []
  )
  const transfer = sessions.find((each) => each?.provider_id === BANK_TRANSFER_PAYMENT_PROVIDER_ID)
  const payment = transfer
    ? "bank_transfer"
    : sessions.some((each) => each?.provider_id === COD_PAYMENT_PROVIDER_ID)
      ? "cash_on_delivery"
      : "card"
  const store = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("store")) as unknown as StoreSettings
  const account = transfer?.data?.["account"] as Record<string, unknown> | undefined
  const deadline = transfer
    ? transferDeadline(order.created_at, { data: transfer.data ?? null })
    : null
  const address = order.shipping_address ?? {}
  const discount = fromMedusaAmount(order.discount_total, { allowRounding: true })
  return {
    vars: {
      number: String(order.display_id),
      customerName: firstText(address["first_name"]) ?? GREETING,
      items: order.items.flatMap((item) =>
        item
          ? [
              {
                title: filled(item.product_title) || filled(item.title),
                detail: filled(item.variant_title) || null,
                quantity: Number(item.quantity),
                total: lira(item.total),
              },
            ]
          : []
      ),
      subtotal: lira(order.item_total),
      shipping: lira(order.shipping_total),
      discount: discount > 0 ? `-${lira(order.discount_total)}` : null,
      total: lira(order.total),
      payment,
      bank:
        payment === "bank_transfer" && typeof account?.["iban"] === "string"
          ? {
              holder: textOf(account["account_holder"]),
              bank: textOf(account["bank_name"]),
              iban: formatIban(account["iban"]),
              deadline: deadline
                ? new Intl.DateTimeFormat("tr-TR", {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: store.timezone,
                  }).format(deadline)
                : null,
            }
          : null,
      address: [
        [filled(address["first_name"]), filled(address["last_name"])].filter(Boolean).join(" "),
        [filled(address["address_2"]), filled(address["address_1"])].filter(Boolean).join(", "),
        [filled(address["city"]), filled(address["province"])].filter(Boolean).join(" / "),
      ].filter(Boolean),
      // Guest orders get a signed link with F10's order page
      orderUrl: null,
    },
    recipients: { email: order.email, sms: address["phone"] ?? null },
    receiverId: order.customer_id,
    resourceType: "order",
  }
}
