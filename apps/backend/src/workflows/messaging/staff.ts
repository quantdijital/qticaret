import { createHash } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../../lib/logging"
import type { MessageTemplateName } from "../../lib/messaging/templates"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type { NotificationSettings } from "../../modules/platform-settings/sections"
import { deliver } from "./deliver"
import { MESSAGE_LOADERS } from "./loaders"

/** Which setting turns each staff alert on. */
const SWITCHES = {
  "staff.new_order": "alert_new_order",
  "staff.bank_transfer": "alert_bank_transfer",
  "staff.low_stock": "alert_low_stock",
  "staff.seo_digest": "alert_seo_digest",
  "staff.contact_message": "alert_contact_message",
} as const satisfies Partial<Record<MessageTemplateName, keyof NotificationSettings>>

export type StaffTemplate = keyof typeof SWITCHES

/**
 * Sends a staff alert by e-mail to each address in Settings >
 * Notifications, when that alert is on (F9.7, adr/0036): once per
 * address (a digest of it is the key), through deliver() as every
 * message. An alert that cannot go is logged; it never fails what
 * raised it.
 */
export async function alertStaff(
  container: Pick<MedusaContainer, "resolve">,
  input: { template: StaffTemplate; resource_id: string; extra?: Record<string, string> }
): Promise<number> {
  try {
    const settings = (await container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .getSection("notifications")) as unknown as NotificationSettings
    if (!settings[SWITCHES[input.template]] || settings.staff_emails.length === 0) {
      return 0
    }
    const load = MESSAGE_LOADERS[input.template] as (typeof MESSAGE_LOADERS)["staff.new_order"]
    const loaded = await load(container, input.resource_id, input.extra ?? {})
    if (!loaded) {
      return 0
    }
    let sent = 0
    for (const email of settings.staff_emails) {
      const outcomes = await deliver(container, {
        template: input.template,
        resource: { type: loaded.resourceType, id: input.resource_id },
        recipients: { email },
        receiverId: null,
        vars: loaded.vars,
        key: createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16),
      })
      sent += outcomes.email === "sent" ? 1 : 0
    }
    return sent
  } catch (error) {
    logger.warn({
      event: "messaging.staff_alert_failed",
      template: input.template,
      err: errorSummary(error),
    })
    return 0
  }
}
