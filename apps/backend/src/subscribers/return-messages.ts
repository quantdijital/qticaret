import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { MessageTemplateName } from "../lib/messaging/templates"
import { sendMessageWorkflow } from "../workflows/messaging/send-message"
import {
  RETURN_REQUEST_APPROVED,
  RETURN_REQUEST_CREATED,
  RETURN_REQUEST_REFUSED,
} from "../workflows/returns/events"
import { RETURN_REFUNDED } from "../workflows/returns/receive-return"

const TEMPLATES: Readonly<Record<string, MessageTemplateName>> = {
  [RETURN_REQUEST_CREATED]: "return.requested",
  [RETURN_REQUEST_APPROVED]: "return.approved",
  [RETURN_REFUNDED]: "return.refunded",
  [RETURN_REQUEST_REFUSED]: "return.refused",
}

/**
 * A return or exchange request's messages (F9.4): received, approved,
 * refunded, and units refused at receipt (adr/0032 Ek 2026-11-03).
 */
export default async function returnMessages({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const template = TEMPLATES[name]
  if (template) {
    await sendMessageWorkflow(container).run({ input: { template, resource_id: data.id } })
  }
}

export const config: SubscriberConfig = {
  event: [RETURN_REQUEST_CREATED, RETURN_REQUEST_APPROVED, RETURN_REFUNDED, RETURN_REQUEST_REFUSED],
}
