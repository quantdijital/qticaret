import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { sharedRateLimitStore } from "../../api/http/rate-limit"
import { logger } from "../../lib/logging"
import { OPEN_TEMPLATES, emailAllowance } from "../../lib/messaging/email/quota"
import type { MessageChannel } from "../../lib/messaging/recipients"
import { smsAllowance } from "../../lib/messaging/sms/quota"
import { notificationText } from "../../lib/notifications/messages"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type { NotificationSettings } from "../../modules/platform-settings/sections"

type Container = Pick<MedusaContainer, "resolve">

/** Tells staff in the bell, once a day, that the channel's day is 80% used. */
async function warnStaff(
  container: Container,
  channel: MessageChannel,
  values: { count: number; limit: number }
) {
  const day = new Date().toISOString().slice(0, 10)
  const kind = `${channel}_daily_limit`
  await container.resolve(Modules.NOTIFICATION).createNotifications({
    to: "",
    channel: "feed",
    template: "admin-ui",
    trigger_type: `messaging.${kind}`,
    resource_id: day,
    idempotency_key: `messaging.${kind}:${day}`,
    data: { kind, ...values, ...notificationText(`messaging.${kind}`, values) },
  })
}

/**
 * Whether one more message may go on the channel. A text: its number's
 * own hourly and daily limits and the shop's daily limit (F9.8). An
 * e-mail: the shop's daily limit (F10 M9), and for one anyone can ask
 * for, its share of it. Reaching 80% of the day's limit tells staff in
 * the bell, once a day; past it nothing goes.
 */
export async function withinQuota(
  container: Container,
  channel: MessageChannel,
  recipientKey: string,
  template: string
): Promise<boolean> {
  const settings = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("notifications")) as unknown as NotificationSettings
  const limit = channel === "sms" ? settings.sms_daily_limit : settings.email_daily_limit
  const allowance =
    channel === "sms"
      ? await smsAllowance(sharedRateLimitStore(), {
          numberKey: recipientKey.slice(0, 32),
          dailyLimit: limit,
        })
      : await emailAllowance(sharedRateLimitStore(), {
          dailyLimit: limit,
          open: OPEN_TEMPLATES.includes(template),
        })
  if (!allowance.allowed) {
    logger.warn({
      event: `messaging.${channel}_quota`,
      reason: "reason" in allowance ? allowance.reason : "shop",
    })
  }
  if (allowance.warn) {
    await warnStaff(container, channel, { count: allowance.shopToday, limit })
  }
  return allowance.allowed
}
