import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { sharedRateLimitStore } from "../../api/http/rate-limit"
import { logger } from "../../lib/logging"
import { smsAllowance } from "../../lib/messaging/sms/quota"
import { notificationText } from "../../lib/notifications/messages"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type { NotificationSettings } from "../../modules/platform-settings/sections"

/**
 * Whether one more text may go to the number (F9.8): its own hourly and
 * daily limits and the shop's daily limit. Reaching 80% of the day's
 * limit tells staff in the bell, once a day; past it no text goes.
 */
export async function withinSmsQuota(
  container: Pick<MedusaContainer, "resolve">,
  numberKey: string
): Promise<boolean> {
  const settings = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("notifications")) as unknown as NotificationSettings
  const allowance = await smsAllowance(sharedRateLimitStore(), {
    numberKey: numberKey.slice(0, 32),
    dailyLimit: settings.sms_daily_limit,
  })
  if (!allowance.allowed) {
    logger.warn({ event: "messaging.sms_quota", reason: allowance.reason })
  }
  if (allowance.warn) {
    const day = new Date().toISOString().slice(0, 10)
    const values = { count: allowance.shopToday, limit: settings.sms_daily_limit }
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: "messaging.sms_daily_limit",
      resource_id: day,
      idempotency_key: `messaging.sms_daily_limit:${day}`,
      data: {
        kind: "sms_daily_limit",
        ...values,
        ...notificationText("messaging.sms_daily_limit", values),
      },
    })
  }
  return allowance.allowed
}
