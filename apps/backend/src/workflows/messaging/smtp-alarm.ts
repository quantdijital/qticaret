import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { notificationText } from "../../lib/notifications/messages"
import { alertStaff } from "./staff"

export interface SmtpRejectionsAlarm {
  rejections: number
  sends: number
  minutes: number
}

/**
 * The shop is told its own mail server is refusing too many recipients
 * (adr/0036 Ek 2026-11-10, security review M2): the bell, once per hour,
 * and the staff e-mail (`staff.smtp_rejections`, on the new-order switch),
 * which may not get through that same server. Never fails what raised it.
 */
export async function alertSmtpRejections(
  container: Pick<MedusaContainer, "resolve">,
  input: SmtpRejectionsAlarm
): Promise<void> {
  const values = {
    rejections: String(input.rejections),
    sends: String(input.sends),
    minutes: String(input.minutes),
  }
  // One alarm an hour: the brake holds that long
  const hour = new Date().toISOString().slice(0, 13)
  try {
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: "messaging.smtp_rejections",
      resource_id: "smtp",
      idempotency_key: `messaging.smtp_rejections:${hour}`,
      data: {
        kind: "smtp_rejections",
        ...values,
        ...notificationText("messaging.smtp_rejections", values),
      },
    })
  } catch (error) {
    logger.warn({ event: "messaging.smtp_alarm_failed", err: errorSummary(error) })
  }
  await alertStaff(container, {
    template: "staff.smtp_rejections",
    resource_id: `smtp:${hour}`,
    extra: values,
  })
}
