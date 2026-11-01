import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { messageText } from "../lib/messaging/texts"
import { notificationText } from "../lib/notifications/messages"
import { CONTACT_MESSAGES_MODULE } from "../modules/contact-messages"
import type ContactMessagesModuleService from "../modules/contact-messages/service"
import { CONTACT_MESSAGE_RECEIVED } from "../workflows/contact/messages"
import { alertStaff } from "../workflows/messaging/staff"

/**
 * The shop hears of a contact message (adr/0047): in the panel's bell, and
 * by e-mail to its staff list when that alert is on. Who wrote and about
 * what; the message itself is read in the panel.
 */
export default async function contactMessageAlerts({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const messages = container.resolve<ContactMessagesModuleService>(CONTACT_MESSAGES_MODULE)
  const [message] = await messages.listContactMessages(
    { id: data.id },
    { select: ["id", "subject", "sealed"], take: 1 }
  )
  if (!message) {
    return
  }
  const name = messages.open(message.sealed).name
  const subject = messageText(`staff_contact.subjects.${message.subject}`)
  await container
    .resolve(Modules.NOTIFICATION)
    .createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: CONTACT_MESSAGE_RECEIVED,
      resource_id: message.id,
      resource_type: "contact_message",
      idempotency_key: `${CONTACT_MESSAGE_RECEIVED}:${message.id}`,
      data: {
        kind: "contact_message",
        message_id: message.id,
        subject: message.subject,
        ...notificationText("contact.message_received", { name, subject }),
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "contact.alert_failed", err: errorSummary(error) })
    })
  await alertStaff(container, { template: "staff.contact_message", resource_id: message.id })
}

export const config: SubscriberConfig = { event: CONTACT_MESSAGE_RECEIVED }
