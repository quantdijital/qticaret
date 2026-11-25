import type { MedusaContainer } from "@medusajs/framework/types"
import { isAiCreditTask } from "@qticaret/types/control-plane"
import type { AiCreditOrder, AiCreditPack, AiCreditsStatus } from "@qticaret/types/control-plane"
import { z } from "@medusajs/framework/zod"
import { aiCreditsStatus } from "../../lib/control-plane/ai-credits"
import { aiGatewayEndpoint } from "../../lib/control-plane/ai-gateway"
import { aiFlagsOf } from "./connections"

/**
 * `GET /admin/ai/credits` (adr/0085 §3, §4): the platform's credits as the
 * shop's panel shows them, built field by field from the control plane's
 * status (kept 60 seconds). Which service runs each capability (the
 * status's `services`) never leaves the server, nor does anything the
 * status may grow later: a field reaches the panel only when named here,
 * and the answer is held to a closed schema. The flag off, the shop
 * unmanaged or the credits unavailable, it says only that, and with the
 * flag off or unmanaged the control plane is not asked.
 */

const count = z.int().min(0)
const day = z.iso.date()

/** A pack as the panel offers it: the control plane's price, never one worked out here. */
const packView = z.strictObject({
  id: z.string(),
  name: z.string(),
  credits: count,
  amount: count,
  currency: z.string(),
})

/** A top-up request as the panel shows it. */
export const aiCreditOrderViewSchema = z.strictObject({
  id: z.string(),
  pack_id: z.string(),
  credits: count,
  amount: count,
  currency: z.string(),
  status: z.string(),
  requested_at: z.string(),
})
export type AiCreditOrderView = z.infer<typeof aiCreditOrderViewSchema>

export const aiCreditsViewSchema = z.discriminatedUnion("available", [
  z.strictObject({ available: z.literal(false) }),
  z.strictObject({
    available: z.literal(true),
    /**
     * This month's grant left and the day it renews (K5); `granted`, the
     * month's whole grant, only when the control plane sends it (P5b).
     */
    plan: z.strictObject({ remaining: count, renews_on: day, granted: count.optional() }),
    /** Bought credits left and their last day (K6); null while none were bought. */
    purchased: z.strictObject({ remaining: count, expires_on: day.nullable() }),
    /** The day's cap and what is left of it today (K7). */
    daily: z.strictObject({ cap: count, remaining: count }),
    /** Credits per task, the gateway's table (K4), for the tasks this shop runs on credits. */
    tasks: z.record(z.string(), count),
    packs: z.array(packView),
    pending_order: aiCreditOrderViewSchema.nullable(),
  }),
])
export type AiCreditsView = z.infer<typeof aiCreditsViewSchema>

const UNAVAILABLE: AiCreditsView = Object.freeze({ available: false })

const packOf = (pack: AiCreditPack) => ({
  id: pack.id,
  name: pack.name,
  credits: pack.credits,
  amount: pack.amount,
  currency: pack.currency,
})

export const aiCreditOrderView = (order: AiCreditOrder): AiCreditOrderView => ({
  id: order.id,
  pack_id: order.pack.id,
  credits: order.pack.credits,
  amount: order.pack.amount,
  currency: order.pack.currency,
  status: order.status,
  requested_at: order.requested_at,
})

/** The status, narrowed; anything not named here (the routing above all) is left behind. */
export function creditsViewOf(status: AiCreditsStatus): AiCreditsView {
  if (!status.available) {
    return UNAVAILABLE
  }
  const { plan, purchased } = status.balance
  const tasks: Record<string, number> = {}
  for (const [task, credits] of Object.entries(status.table)) {
    // A task this shop does not run on credits is no button of its panel
    if (isAiCreditTask(task)) {
      tasks[task] = credits
    }
  }
  return aiCreditsViewSchema.parse({
    available: true,
    plan: {
      remaining: plan.remaining,
      renews_on: plan.renews_on,
      // A control plane before P5b sends no whole: the answer stays as it was
      ...(plan.granted === undefined ? {} : { granted: plan.granted }),
    },
    purchased: { remaining: purchased.remaining, expires_on: purchased.expires_on },
    daily: { cap: status.daily.cap, remaining: status.daily.remaining },
    tasks,
    packs: status.packs.map(packOf),
    pending_order: status.pending_order === null ? null : aiCreditOrderView(status.pending_order),
  })
}

export async function aiCreditsView(
  container: Pick<MedusaContainer, "resolve">
): Promise<AiCreditsView> {
  const flags = await aiFlagsOf(container)
  if (flags.platformCredits !== true || aiGatewayEndpoint() === null) {
    return UNAVAILABLE
  }
  return creditsViewOf(await aiCreditsStatus())
}
