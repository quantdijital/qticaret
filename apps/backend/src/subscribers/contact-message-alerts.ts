import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { sharedRateLimitStore } from "../api/http/rate-limit"
import { errorSummary, logger } from "../lib/logging"
import { messageText } from "../lib/messaging/texts"
import { notificationText } from "../lib/notifications/messages"
import { CONTACT_MESSAGES_MODULE } from "../modules/contact-messages"
import type ContactMessagesModuleService from "../modules/contact-messages/service"
import { contactAnswerDue } from "../workflows/contact/answer-due"
import { bookingRequestFacts } from "../workflows/contact/booking-request-text"
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
    { select: ["id", "subject", "product_id", "details", "created_at"], take: 1 }
  )
  if (!message) {
    return
  }
  const subject = messageText(`staff_contact.subjects.${message.subject}`)
  // A KVKK request (adr/0047 Ek 2026-11-02): the bell names the law's last day
  const due =
    message.subject === "kvkk" ? await contactAnswerDue(container, message.created_at) : null
  // A booking request (adr/0076 Ek 2026-11-23): the bell names the product, dates and people
  const request =
    message.subject === "booking" ? await bookingRequestFacts(container, message) : null
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
        ...(due
          ? { due_at: due.at, ...notificationText("contact.kvkk_received", { due: due.text }) }
          : request
            ? {
                product_id: message.product_id,
                ...notificationText("contact.booking_received", {
                  product: request.product,
                  request: request.line,
                }),
              }
            : notificationText("contact.message_received", { subject })),
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "contact.alert_failed", err: errorSummary(error) })
    })
  // A KVKK request has a budget of its own: a flood of other messages never
  // keeps its e-mail back
  const { count } = await sharedRateLimitStore().hit(
    message.subject === "kvkk" ? "contact:staff-mail:kvkk" : "contact:staff-mail",
    MAIL_EVERY_MS
  )
  if (count === 1) {
    await alertStaff(container, { template: "staff.contact_message", resource_id: message.id })
  }
}

export const config: SubscriberConfig = { event: CONTACT_MESSAGE_RECEIVED }
