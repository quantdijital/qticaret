import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { AI_TASK_CREDITS, aiCreditsStatusSchema } from "@qticaret/types/control-plane"
import type { AiCreditOrder, AiCreditsStatus } from "@qticaret/types/control-plane"
import type { AiCreditOrderRow } from "../../modules/ai-credits/service"
import { plansIn } from "../../workflows/modules"
import { balanceOf } from "../ai-credits/balance"
import { requestOrder } from "../ai-credits/grant"
import { activePacks, aiCreditSettingsOf } from "../ai-credits/platform-settings"
import { pendingOrderOf } from "../ai-credits/staff"
import { istanbulDay } from "../billing/days"
import { effectiveFlags } from "../fleet/plan-content"
import { providerKeysHeld } from "./keys"

type Container = Pick<MedusaContainer, "resolve">

/**
 * What a shop learns of the platform's credits over its signed API
 * (adr/0085 §2): whether they can be used now and, only then, its own
 * wallet, the service behind each capability, the table, the packs and
 * its pending request; and its top-up request. The shop is the one the
 * signature names; nothing here reads a shop's id from anywhere else.
 */

export const PLATFORM_CREDITS_FLAG = "ai.platform_credits"

/**
 * The shop's `ai.platform_credits` as its plan document says it: its own
 * exception while it holds, else its package's, else the list's default
 * (off). A shop on no package has no document: off.
 */
export async function platformCreditsOn(
  container: Container,
  tenantId: string,
  now: Date
): Promise<boolean> {
  const plans = plansIn(container)
  const [plan, overrides] = await Promise.all([
    plans.planOf(tenantId),
    plans.featureOverridesOf(tenantId),
  ])
  if (!plan) {
    return false
  }
  return (
    effectiveFlags(plan.features, overrides, now, process.env["NODE_ENV"]).find(
      (flag) => flag.key === PLATFORM_CREDITS_FLAG
    )?.value === true
  )
}

/** Capability → service, for each routed capability whose service's key the vault holds. */
export async function servicesInForce(container: Container): Promise<Record<string, string>> {
  const [settings, keys] = await Promise.all([
    aiCreditSettingsOf(container),
    providerKeysHeld(container),
  ])
  return Object.fromEntries(
    Object.entries(settings.routing)
      .filter(([, route]) => keys.has(route.service))
      .map(([capability, route]) => [capability, route.service])
  )
}

const UNAVAILABLE: AiCreditsStatus = Object.freeze({ available: false as const })

const orderOf = (row: AiCreditOrderRow): AiCreditOrder => ({
  id: row.id,
  pack: {
    id: row.pack_id,
    name: row.pack_name,
    credits: row.credits,
    amount: row.amount,
    currency: "TRY",
  },
  status: row.status,
  requested_at: row.requested_at.toISOString(),
})

/** The last Istanbul day of a moment that ends a validity (it is no longer valid at it). */
const lastDayBefore = (end: Date): string => istanbulDay(new Date(end.getTime() - 1))

/**
 * `GET /tenant-api/v1/ai/credits` (adr/0085 §2): available only with the
 * flag on, a capability routed and its service's key held. Unavailable,
 * it says only that, and the shop's wallet is neither read nor opened.
 */
export async function creditsStatusOf(
  container: Container,
  tenantId: string,
  now: Date
): Promise<AiCreditsStatus> {
  if (!(await platformCreditsOn(container, tenantId, now))) {
    return UNAVAILABLE
  }
  const services = await servicesInForce(container)
  if (Object.keys(services).length === 0) {
    return UNAVAILABLE
  }
  const [balance, settings, pending] = await Promise.all([
    balanceOf(container, tenantId, now),
    aiCreditSettingsOf(container),
    pendingOrderOf(container, tenantId),
  ])
  const expiresAt = balance.purchased.expiresAt
  // Held to the contract before it leaves: a shape the shop would refuse is never sent
  return aiCreditsStatusSchema.parse({
    available: true,
    balance: {
      plan: { remaining: balance.plan.balance, renews_on: balance.plan.renewsOn },
      purchased: {
        remaining: balance.purchased.balance,
        expires_on: expiresAt === null ? null : lastDayBefore(expiresAt),
      },
    },
    daily: { cap: balance.daily.cap, remaining: balance.daily.remaining },
    services,
    table: { ...AI_TASK_CREDITS },
    packs: activePacks(settings),
    pending_order: pending === null ? null : orderOf(pending),
  })
}

/**
 * `POST /tenant-api/v1/ai/orders` (K11): a top-up asked for with an
 * active pack's id; its credits and price are the platform's pack's. Not
 * available (flag, key or routing): `ai_credits.unavailable`; a pack
 * unknown or not offered: `ai_credits.pack_unknown`; a request already
 * pending: `cp.ai_credit_order_pending`.
 */
export async function requestTopUp(
  container: Container,
  input: { tenantId: string; packId: string; requestedBy: string; now: Date }
): Promise<AiCreditOrder> {
  if (!(await platformCreditsOn(container, input.tenantId, input.now))) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "ai_credits.unavailable")
  }
  if (Object.keys(await servicesInForce(container)).length === 0) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "ai_credits.unavailable")
  }
  const pack = activePacks(await aiCreditSettingsOf(container)).find(
    (each) => each.id === input.packId
  )
  if (!pack) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "ai_credits.pack_unknown")
  }
  const row = await requestOrder(container, {
    tenantId: input.tenantId,
    pack,
    requestedBy: input.requestedBy,
    now: input.now,
  })
  return orderOf(row)
}
