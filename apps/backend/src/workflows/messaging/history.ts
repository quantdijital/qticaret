import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { maskRecipient, normalizeRecipient } from "../../lib/messaging/recipients"
import type { MessageChannel } from "../../lib/messaging/recipients"
import { MESSAGE_TEMPLATES } from "../../lib/messaging/templates"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type { MessageSkipReason } from "../../modules/messaging/models/message-skip"
import type MessagingModuleService from "../../modules/messaging/service"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"

type Container = Pick<MedusaContainer, "resolve">

/** Whether the template goes to the shop's customers; the team's own alerts are not their history. */
export const isCustomerTemplate = (name: string): boolean => !name.startsWith("staff.")

const CUSTOMER_TEMPLATES = Object.keys(MESSAGE_TEMPLATES).filter(isCustomerTemplate)

/** What an order's history reads besides the order: its parcels' and return requests' messages. */
export const HISTORY_RESOURCE_TYPES = new Set(["order", "fulfillment", "return_request"])

/**
 * The order's messages staff may send again (2026-11-06), from their
 * templates only: the confirmation, the parcel's shipping and delivery,
 * the invoice's link.
 */
export const RESENDABLE_TEMPLATES: ReadonlySet<string> = new Set([
  "order.placed",
  "order.shipped",
  "order.delivered",
  "order.invoiced",
])

// The latest of each kind; an order or a customer rarely has more
const SHOWN = 50

export type MessageState = "sent" | "pending" | "failed" | "skipped"

/** One message to a customer: sent by Medusa, or not sent and why (F12.8). */
export interface MessageRow {
  id: string
  template: string
  channel: MessageChannel
  state: MessageState
  reason: MessageSkipReason | null
  /** The address masked: enough to recognise it, not to use it. */
  to: string | null
  at: string
  /** Whether "Mesajı yeniden gönder" is offered: an order's message, one of its templates. */
  resendable: boolean
}

interface NotificationRow {
  id: string
  to?: string | null
  channel: string
  template?: string | null
  status?: string | null
  created_at: string | Date
}

const STATE: Record<string, MessageState> = {
  success: "sent",
  pending: "pending",
  failure: "failed",
}

const channelOf = (value: string): MessageChannel => (value === "sms" ? "sms" : "email")

function masked(channel: MessageChannel, to: string | null | undefined): string | null {
  const normalized = to ? normalizeRecipient(channel, to) : null
  return normalized ? maskRecipient(channel, normalized) : null
}

type Where = { resource_id: string[] } | { receiver_id: string }

async function history(
  container: Container,
  where: Where,
  resend = false
): Promise<{ messages: MessageRow[]; limited: boolean }> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "notification",
    fields: ["id", "to", "channel", "template", "status", "created_at"],
    filters: { ...where, template: CUSTOMER_TEMPLATES },
    pagination: { take: SHOWN, order: { created_at: "DESC" } },
  })
  const sent = (data as NotificationRow[]).map((row): MessageRow => {
    const channel = channelOf(row.channel)
    const state = STATE[row.status ?? ""] ?? "pending"
    return {
      id: row.id,
      template: row.template ?? "",
      channel,
      state,
      reason: null,
      to: masked(channel, row.to),
      at: new Date(row.created_at).toISOString(),
      resendable: resend && state !== "pending" && RESENDABLE_TEMPLATES.has(row.template ?? ""),
    }
  })
  const skips = await container.resolve<MessagingModuleService>(MESSAGING_MODULE).listMessageSkips(
    { ...where, template: CUSTOMER_TEMPLATES },
    {
      take: SHOWN,
      order: { updated_at: "DESC" },
      select: ["id", "template", "channel", "reason", "recipient_masked", "updated_at"],
    }
  )
  const skipped = skips.map((row): MessageRow => ({
    id: row.id,
    template: row.template,
    channel: row.channel,
    state: "skipped",
    reason: row.reason,
    to: row.recipient_masked ?? null,
    at: new Date(row.updated_at).toISOString(),
    resendable: false,
  }))
  return {
    messages: [...sent, ...skipped].sort((a, b) => b.at.localeCompare(a.at)).slice(0, SHOWN),
    limited: sent.length === SHOWN || skipped.length === SHOWN,
  }
}

/**
 * What the order's customer was sent about it (F12.8): the order's own
 * messages, its parcels' and its return requests', newest first, with the
 * ones not sent and why. Addresses masked; the messages themselves were
 * never stored.
 */
export async function orderMessages(container: Container, orderId: string) {
  return history(container, { resource_id: await orderMessageResources(container, orderId) }, true)
}

/**
 * What an order's messages are about: the order, its parcels, its return
 * requests and its sale invoices (the invoice's link goes under the
 * invoice's id).
 */
export async function orderMessageResources(
  container: Container,
  orderId: string
): Promise<string[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "fulfillments.id"],
    filters: { id: orderId },
  })
  const order = data[0] as { fulfillments?: ({ id: string } | null)[] | null } | undefined
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  const [requests, invoices] = await Promise.all([
    container
      .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
      .listReturnRequests({ order_id: orderId }, { select: ["id"] }),
    container
      .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
      .listInvoices({ order_id: orderId, kind: "sale" }, { select: ["id"] }),
  ])
  return [
    orderId,
    ...(order.fulfillments ?? []).flatMap((parcel) => (parcel ? [parcel.id] : [])),
    ...requests.map((request) => request.id),
    ...invoices.map((invoice) => invoice.id),
  ]
}

/** Everything the customer was sent, or not and why (F12.8), newest first. */
export async function customerMessages(container: Container, customerId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["id"],
    filters: { id: customerId },
  })
  if (data.length === 0) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "customers.unknown")
  }
  return history(container, { receiver_id: customerId })
}
