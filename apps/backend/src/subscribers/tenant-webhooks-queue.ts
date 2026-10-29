import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import type { WebhookEvent } from "../lib/webhooks"
import { TENANT_WEBHOOKS_MODULE } from "../modules/tenant-webhooks"
import type TenantWebhooksModuleService from "../modules/tenant-webhooks/service"

interface EventData {
  id?: string
  order_id?: string
  fulfillment_id?: string
  return_id?: string
}

const EVENTS: Readonly<Record<string, WebhookEvent>> = {
  "order.placed": "order.placed",
  "order.canceled": "order.canceled",
  "order.fulfillment_created": "order.fulfilled",
  "order.return_requested": "return.requested",
  "order.return_received": "return.received",
}

/** The order as a body has it: numbers and states, nothing of the person. */
async function orderOf(container: MedusaContainer, id: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id", "status", "currency_code", "total", "items.quantity"],
    filters: { id },
  })
  const order = data[0] as
    | {
        id: string
        display_id: number
        status: string
        currency_code: string
        total: number | string
        items?: ({ quantity: number | string } | null)[] | null
      }
    | undefined
  return order
    ? {
        order_id: order.id,
        display_id: order.display_id,
        status: order.status,
        currency_code: order.currency_code,
        total: String(order.total),
        units: (order.items ?? []).reduce((sum, item) => sum + Number(item?.quantity ?? 0), 0),
      }
    : null
}

/**
 * An order or return event queued for the subscriptions that take it
 * (F11.7, adr/0039 §7). One insert per subscription, none when nobody
 * subscribed; the order flow never waits and a failure is only logged.
 */
export default async function tenantWebhooksQueue({
  event: { name, data },
  container,
}: SubscriberArgs<EventData>) {
  const event = EVENTS[name]
  const orderId = name === "order.placed" || name === "order.canceled" ? data.id : data.order_id
  if (!event || !orderId) {
    return
  }
  try {
    const hooks = container.resolve<TenantWebhooksModuleService>(TENANT_WEBHOOKS_MODULE)
    if (!(await hooks.anyTakes(event))) {
      return
    }
    const order = await orderOf(container, orderId)
    if (!order) {
      return
    }
    const subject = data.fulfillment_id ?? data.return_id ?? orderId
    await hooks.enqueue(event, `${event}:${subject}`, {
      ...order,
      ...(data.fulfillment_id ? { fulfillment_id: data.fulfillment_id } : {}),
      ...(data.return_id ? { return_id: data.return_id } : {}),
    })
  } catch (error) {
    logger.warn({ event: "webhooks.queue_failed", source: name, err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = { event: Object.keys(EVENTS) }
