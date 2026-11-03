import type { MedusaContainer } from "@medusajs/framework/types"
import { sharedRateLimitStore } from "../../api/http/rate-limit"
import { quotaDay } from "../../lib/campaigns/pause"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { NotificationSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/**
 * What is left of the day's commercial budget on the channel, read from
 * the counters deliver() keeps (lib/messaging/email/quota.ts, sms/quota.ts)
 * without counting a send: the e-mails' commercial day, the shop's texts.
 */
export async function quotaLeft(
  container: Pick<MedusaContainer, "resolve">,
  channel: "email" | "sms",
  now: Date
): Promise<{ left: number; limit: number }> {
  const settings = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("notifications")) as unknown as NotificationSettings
  const day = quotaDay(now)
  const used = await sharedRateLimitStore().peek(
    channel === "email" ? `email:commercial:${day}` : `sms:shop:${day}`
  )
  const limit = channel === "email" ? settings.email_daily_limit : settings.sms_daily_limit
  return { left: Math.max(0, limit - used), limit }
}
