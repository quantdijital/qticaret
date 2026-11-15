import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { errorSummary, logger } from "../../lib/logging"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { CUSTOMERS_WHOLESALE } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { claimAccountWorkflow, claimableAccount } from "../../workflows/wholesale/accounts/claim"

/**
 * An invited wholesaler reading their account takes the pending wholesale
 * account of their address (ADR-0068 §3), beside `attachGuestOrders` and
 * on its proof: a signed-in customer with a sign-in, whose address it is.
 * Only while the shop sells wholesale; a failure only leaves them a
 * retail customer for this request. No `methods` on its route (Medusa's
 * own `/store/customers/me`): the method is checked here. Most readers
 * have nothing to take, found with one read and no workflow.
 */
export async function claimWholesaleAccount(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  if (req.method !== "GET" || auth?.actor_type !== "customer" || !auth.actor_id) {
    next()
    return
  }
  const customerId = auth.actor_id
  try {
    const enabled = await req.scope
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .isFeatureEnabled(CUSTOMERS_WHOLESALE)
    if (enabled && (await claimableAccount(req.scope, customerId)) !== null) {
      await claimAccountWorkflow(req.scope).run({ input: { customer_id: customerId } })
    }
  } catch (error) {
    logger.warn({ event: "wholesale.claim_failed", err: errorSummary(error) })
  }
  next()
}
