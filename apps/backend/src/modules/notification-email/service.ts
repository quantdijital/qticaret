import type { NotificationTypes } from "@medusajs/framework/types"
import { AbstractNotificationProviderService } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { emailTransport } from "../../lib/messaging/email"

/** What our send step puts in `provider_data`: who the e-mail is from, where answers go. */
interface Sender {
  from_email: string
  from_name: string
  reply_to: string | null
}

const senderOf = (data: Record<string, unknown> | null | undefined): Sender | null => {
  const from = data?.["from_email"]
  const name = data?.["from_name"]
  const replyTo = data?.["reply_to"]
  return typeof from === "string" && typeof name === "string"
    ? { from_email: from, from_name: name, reply_to: typeof replyTo === "string" ? replyTo : null }
    : null
}

/**
 * E-mail as a Medusa notification provider (`email` channel, adr/0036).
 * It sends what our send step rendered (`content`), from the sender the
 * step chose, through the instance's transport (Resend, or Mailpit on a
 * developer's machine). The rendered content is never stored by Medusa,
 * and nothing here logs it.
 */
class EmailNotificationService extends AbstractNotificationProviderService {
  static override identifier = "email"

  static override validateOptions(options: Record<string, unknown>): void {
    const channels = options["channels"]
    if (!Array.isArray(channels) || !channels.includes("email")) {
      throw new Error("notification-email: configure it for the email channel")
    }
  }

  override async send(
    notification: NotificationTypes.ProviderSendNotificationDTO
  ): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    const transport = emailTransport()
    if (!transport) {
      throw new ValidationError("messaging.email_off")
    }
    const sender = senderOf(notification.provider_data)
    const content = notification.content
    if (!sender || !content?.subject || !content.html) {
      // Only our send step calls this channel: anything else is a programming error
      throw new Error("notification-email: send through the messaging step")
    }
    // Medusa hands over the whole notification: its key makes a repeat send once
    const row = notification as { id?: unknown; idempotency_key?: unknown }
    const key =
      typeof row.idempotency_key === "string" && row.idempotency_key !== ""
        ? row.idempotency_key
        : typeof row.id === "string"
          ? row.id
          : ""
    const { id } = await transport.send({
      from: { email: sender.from_email, name: sender.from_name },
      to: notification.to,
      replyTo: sender.reply_to,
      subject: content.subject,
      html: content.html,
      text: content.text ?? "",
      template: notification.template,
      idempotencyKey: key,
    })
    return { id }
  }
}

export default EmailNotificationService
