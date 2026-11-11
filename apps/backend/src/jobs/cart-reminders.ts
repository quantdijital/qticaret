import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { planModeFor } from "../lib/plan-guard"
import { PLATFORM_SETTINGS_MODULE } from "../modules/platform-settings"
import type PlatformSettingsModuleService from "../modules/platform-settings/service"
import type { MarketingSettings } from "../modules/platform-settings/sections"
import {
  findAbandonedCartsWorkflow,
  remindCartWorkflow,
} from "../workflows/marketing/cart-reminders"
import { brandOf } from "../workflows/messaging/brand"

/** Carts reminded in one run at most; the rest wait for the next. */
const BATCH = 100

/**
 * Reminds shoppers of carts left behind (F10.7, adr/0038 §1), once the
 * shop turns it on and has a storefront domain for the link. One cart's
 * failure leaves the others to go.
 */
export default async function cartReminders(container: MedusaContainer) {
  // adr/0061 Ek C15 (review M1): a suspended shop's storefront answers 503; no link to it
  if ((await planModeFor(container)) === "suspended") {
    return
  }
  const settings = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("marketing")) as unknown as MarketingSettings
  if (!settings.abandoned_cart_enabled || !(await brandOf(container)).storefrontUrl) {
    return
  }
  const { result: cartIds } = await findAbandonedCartsWorkflow(container).run({
    input: { delay_minutes: settings.abandoned_cart_delay_minutes, limit: BATCH },
  })
  const outcomes: Record<string, number> = {}
  for (const cartId of cartIds) {
    try {
      const { result } = await remindCartWorkflow(container).run({ input: { cart_id: cartId } })
      outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1
    } catch (error) {
      logger.warn({ event: "cart_reminders.failed", cart_id: cartId, err: errorSummary(error) })
    }
  }
  if (cartIds.length > 0) {
    logger.info({ event: "cart_reminders.run", carts: cartIds.length, outcomes })
  }
}

export const config = {
  name: "cart-reminders",
  schedule: "*/15 * * * *",
}
