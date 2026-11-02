import type { MedusaContainer } from "@medusajs/framework/types"
import { privacyAnswerDue, privacyAnswerDueText } from "../../lib/legal/answer-due"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type { StoreSettings } from "../../modules/platform-settings/sections"

/**
 * A KVKK request sent from the contact form (adr/0047 Ek 2026-11-02): the
 * law's 30 days run from the day it came, counted as for a request staff
 * record (adr/0041 §6), the last day in the shop's own time zone.
 */
export async function contactAnswerDue(
  container: Pick<MedusaContainer, "resolve">,
  received: Date | string
): Promise<{ at: string; text: string }> {
  const store = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("store")) as unknown as StoreSettings
  const came = new Date(received)
  return {
    at: privacyAnswerDue(came).toISOString(),
    text: privacyAnswerDueText(came, store.timezone),
  }
}
