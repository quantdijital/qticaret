import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logger } from "../../../lib/logging"
import type { OrderLinkVars, OrderVars } from "../../../lib/messaging/templates"
import { fromMedusaAmount } from "../../../lib/money"
import {
  ORDER_ACCESS_DAYS,
  ORDER_PATH,
  orderAccessKey,
  orderAccessToken,
} from "../../../lib/orders"
import type { MedusaAmount } from "../../../lib/money"
import { transferDeadline } from "../../../lib/payments/bank-transfer"
import {
  BANK_TRANSFER_PAYMENT_PROVIDER_ID,
  COD_PAYMENT_PROVIDER_ID,
} from "../../../lib/payments/checkout"
import { CHECKOUT_SMS_HELD } from "../../../lib/messaging/sms/quota"
import { formatIban } from "../../../lib/tr/iban"
import { LEGAL_MODULE } from "../../../modules/legal"
import type LegalModuleService from "../../../modules/legal/service"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import type { StoreSettings } from "../../../modules/platform-settings/sections"
import { brandOf } from "../brand"
import { messageAddonsOf } from "./line-addons"
import { GREETING, addressLine, lira, personName } from "./types"
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
  // A line's add-on picks (adr/0052 §9)
  "items.metadata",
  // An order nothing ships for has no shipping row or delivery address (adr/0076 §6)
  "items.requires_shipping",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.phone",
  "payment_collections.payment_sessions.provider_id",
  "payment_collections.payment_sessions.data",
  "cart.id",
  "cart.metadata",
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
    metadata?: Record<string, unknown> | null
    requires_shipping?: boolean | null
  } | null)[]
  shipping_address: Record<string, string | null | undefined> | null
  payment_collections:
    | ({
        payment_sessions?:
          ({ provider_id: string; data?: Record<string, unknown> | null } | null)[] | null
      } | null)[]
    | null
  cart?: { id?: string; metadata?: Record<string, unknown> | null } | null
}

export { lira }

const filled = (value: string | null | undefined): string => (value ?? "").trim()

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/**
 * The storefront's page of the order with its key (adr/0037 §2): a guest
 * opens it from the e-mail, a customer too without signing in. Null until
 * the shop has a domain, or for an order without an e-mail.
 */
async function orderUrlOf(
  container: Pick<MedusaContainer, "resolve">,
  order: { id: string; email: string | null }
): Promise<string | null> {
  const { storefrontUrl } = await brandOf(container)
  if (!storefrontUrl || !order.email) {
    return null
  }
  const token = orderAccessToken(orderAccessKey(), { id: order.id, email: order.email })
  return `${storefrontUrl}${ORDER_PATH}/${encodeURIComponent(order.id)}?${new URLSearchParams({ token }).toString()}`
}

/** Whether the shopper accepted the contracts at checkout: the order keeps them (F13.2). */
async function hasContracts(
  container: Pick<MedusaContainer, "resolve">,
  cartId: string | undefined
): Promise<boolean> {
  if (!cartId) {
    return false
  }
  const [consent] = await container
    .resolve<LegalModuleService>(LEGAL_MODULE)
    .listLegalConsents({ cart_id: cartId }, { take: 1, select: ["id"] })
  return consent !== undefined
}

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
  const lines = order.items.flatMap((item) => (item ? [item] : []))
  const ships = lines.length === 0 || lines.some((item) => item.requires_shipping !== false)
  return {
    vars: {
      number: String(order.display_id),
      customerName: personName(textOf(address["first_name"])) ?? GREETING,
      items: order.items.flatMap((item) =>
        item
          ? [
              {
                title: filled(item.product_title) || filled(item.title),
                detail: filled(item.variant_title) || null,
                quantity: Number(item.quantity),
                total: lira(item.total),
                ...messageAddonsOf(item.metadata),
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
        [personName(filled(address["first_name"])), personName(filled(address["last_name"]))]
          .filter(Boolean)
          .join(" "),
        [filled(address["address_2"]), filled(address["address_1"])].filter(Boolean).join(", "),
        [filled(address["city"]), filled(address["province"])].filter(Boolean).join(" / "),
      ]
        .map(addressLine)
        .filter((line): line is string => line !== null),
      // Left out for a shipped order: its message as it was
      ...(ships ? {} : { ships: false }),
      orderUrl: await orderUrlOf(container, order),
      contracts: await hasContracts(container, order.cart?.id),
    },
    recipients: { email: order.email, sms: address["phone"] ?? null },
    receiverId: order.customer_id,
    resourceType: "order",
    // Checkout held its texts: its address completed too many carts (F10 M9)
    ...(order.cart?.metadata?.[CHECKOUT_SMS_HELD] === true ? { held: ["sms" as const] } : {}),
  }
}

/**
 * The order's link a shopper asked for (adr/0037 §2), to the order's own
 * address only; without a storefront domain there is no page to send.
 */
export async function loadOrderLink(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string
): Promise<Loaded<OrderLinkVars> | null> {
  const loaded = await loadOrderMessage(container, orderId)
  if (!loaded?.vars.orderUrl) {
    logger.info({ event: "messaging.not_sent", template: "order.access_link", reason: "no_link" })
    return null
  }
  return {
    vars: {
      number: loaded.vars.number,
      customerName: loaded.vars.customerName,
      orderUrl: loaded.vars.orderUrl,
      days: ORDER_ACCESS_DAYS,
    },
    recipients: { email: loaded.recipients.email ?? null },
    receiverId: loaded.receiverId,
    resourceType: "order",
  }
}
