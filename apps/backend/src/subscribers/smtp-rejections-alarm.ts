import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { SMTP_REJECTIONS_EVENT } from "../lib/messaging/email/smtp-bounce"
import { alertSmtpRejections } from "../workflows/messaging/smtp-alarm"
import type { SmtpRejectionsAlarm } from "../workflows/messaging/smtp-alarm"

/** The shop's mail server refuses too many recipients (adr/0036 Ek 2026-11-10): the bell and the staff. */
export default async function smtpRejectionsAlarm({
  event: { data },
  container,
}: SubscriberArgs<SmtpRejectionsAlarm>) {
  await alertSmtpRejections(container, data)
}

export const config: SubscriberConfig = { event: SMTP_REJECTIONS_EVENT }
