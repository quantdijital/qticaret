import { aiTargetModels } from "@qticaret/types/control-plane"
import { AI_TARGET_CAPABILITIES } from "@qticaret/types/control-plane"
import type { AiCreditPlatformSettings } from "../../../../lib/ai-credits/platform-settings"
import { keyedServices } from "../../../../lib/ai-gateway/keys"
import type { AiCreditOrderRow } from "../../../../modules/ai-credits/service"
import type { OrderShop } from "./shops"

/**
 * How the AI credits' staff routes answer (adr/0085 §5). Never a
 * provider's key: what is shown of one is whether it is held, its version
 * and when it was written.
 */

export const settingsView = (settings: AiCreditPlatformSettings) => ({
  daily_cap: settings.dailyCap,
  purchased_lifetime_months: settings.lifetimeMonths,
  packs: settings.packs,
  routing: settings.routing,
  updated_at: settings.updatedAt,
  updated_by: settings.updatedBy,
})

/** What may be routed: each service the platform may hold a key for, its capabilities and models. */
export const targetsView = () =>
  keyedServices().map((service) => ({
    service,
    capabilities: Object.fromEntries(
      AI_TARGET_CAPABILITIES.flatMap((capability) => {
        const models = aiTargetModels(service, capability, process.env["NODE_ENV"])
        return models === null ? [] : [[capability, models]]
      })
    ),
  }))

/**
 * A request as the staff routes show it; `tenant`, its shop's name, slug
 * and primary address (P3d), null for a shop no longer on the list.
 */
export const orderView = (order: AiCreditOrderRow, tenant: OrderShop | null) => ({
  id: order.id,
  tenant_id: order.tenant_id,
  pack: {
    id: order.pack_id,
    name: order.pack_name,
    credits: order.credits,
    amount: order.amount,
    currency: order.currency,
  },
  status: order.status,
  method: order.method,
  reference: order.reference,
  requested_by: order.requested_by,
  decided_by: order.decided_by,
  requested_at: order.requested_at,
  decided_at: order.decided_at,
  tenant,
})

/** A settings change for the audit row: the values that moved, as `{ from, to }`. */
export function settingsChanges(before: AiCreditPlatformSettings, after: AiCreditPlatformSettings) {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  const note = (name: string, from: unknown, to: unknown) => {
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[name] = { from, to }
    }
  }
  note("daily_cap", before.dailyCap, after.dailyCap)
  note("purchased_lifetime_months", before.lifetimeMonths, after.lifetimeMonths)
  const packs = (settings: AiCreditPlatformSettings) =>
    settings.packs.map(({ id, credits, amount, active }) => ({ id, credits, amount, active }))
  note("packs", packs(before), packs(after))
  note("routing", before.routing, after.routing)
  return changes
}
