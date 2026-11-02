import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { sharedRateLimitStore } from "../api/http/rate-limit"
import { errorSummary, logger } from "../lib/logging"
import { messageText } from "../lib/messaging/texts"
import { notificationText } from "../lib/notifications/messages"
import { CONTACT_MESSAGES_MODULE } from "../modules/contact-messages"
import type ContactMessagesModuleService from "../modules/contact-messages/service"
import { CONTACT_MESSAGE_RECEIVED } from "../workflows/contact/messages"
import { alertStaff } from "../workflows/messaging/staff"

/**
 * The staff e-mail goes at most once in this long, shop-wide (security
 * review 2026-11-02): a flood of messages from many addresses would
 * otherwise spend the day's e-mail budget the orders need. The bell and
 * the panel list show every message.
 */
const MAIL_EVERY_MS = 10 * 60 * 1000

/**
 * The shop hears of a contact message (adr/0047): in the panel's bell, and
 * by e-mail to its staff list when that alert is on. The subject only:
 * the sender's name and words stay in the sealed message, so nothing of
 * the person outlives its deletion, and nothing they typed goes out in the
 * shop's own mail.
 */
export default async function contactMessageAlerts({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const messages = container.resolve<ContactMessagesModuleService>(CONTACT_MESSAGES_MODULE)
  const [message] = await messages.listContactMessages(
    { id: data.id },
    { select: ["id", "subject"], take: 1 }
  )
  if (!message) {
    return
  }
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
        ...notificationText("contact.message_received", { subject }),
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "contact.alert_failed", err: errorSummary(error) })
    })
  const { count } = await sharedRateLimitStore().hit("contact:staff-mail", MAIL_EVERY_MS)
  if (count === 1) {
    await alertStaff(container, { template: "staff.contact_message", resource_id: message.id })
  }
}

export const config: SubscriberConfig = { event: CONTACT_MESSAGE_RECEIVED }
