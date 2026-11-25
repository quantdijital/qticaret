import { randomBytes } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { AI_CREDIT_CURRENCY, aiCreditPackSchema } from "@qticaret/types/control-plane"
import type { AiCreditPack } from "@qticaret/types/control-plane"
import { z } from "zod"
import type { AiCreditSettingRow } from "../../modules/ai-credits/service"
import { aiCreditsIn } from "../../workflows/modules"
import { checkedRouting, storedRouting } from "../ai-gateway/routing"
import type { AiRoute, AiRouting } from "../ai-gateway/routing"

type Container = Pick<MedusaContainer, "resolve">

/** At most this many top-up packs (the migration's check too). */
export const AI_PACKS_MAX = 10

/** A pack as the platform keeps it: what a shop sees, and whether it is offered now. */
export type AiPackSetting = AiCreditPack & { active: boolean }

const storedPack = aiCreditPackSchema.extend({ active: z.boolean() })

export interface AiCreditPlatformSettings {
  /** K7: the day's cap of every wallet without its own. */
  dailyCap: number
  /** K6: how many months bought credits last from the last top-up. */
  lifetimeMonths: number
  /** K11, K12: the top-up packs, active or not. */
  packs: AiPackSetting[]
  /** §2: capability → service and model. */
  routing: AiRouting
  updatedAt: Date | null
  updatedBy: string | null
}

/** A pack as the owner sends it: `id` only for one already kept (ids are made here). */
export interface AiPackInput {
  id?: string | undefined
  name: string
  credits: number
  amount: number
  active: boolean
}

/** A change to the settings; what is left out stays as it is. `routing`, when given, is the whole of it. */
export interface AiSettingsChange {
  daily_cap?: number | undefined
  purchased_lifetime_months?: number | undefined
  packs?: readonly AiPackInput[] | undefined
  routing?: Readonly<Record<string, AiRoute | null>> | undefined
}

function storedPacks(value: unknown): AiPackSetting[] {
  if (!Array.isArray(value)) {
    return []
  }
  // A stored pack that no longer reads (by hand, or an older shape) is left out, never offered
  return value.flatMap((each) => {
    const parsed = storedPack.safeParse(each)
    return parsed.success ? [parsed.data] : []
  })
}

const settingsOf = (row: AiCreditSettingRow): AiCreditPlatformSettings => ({
  dailyCap: row.daily_cap,
  lifetimeMonths: row.purchased_lifetime_months,
  packs: storedPacks(row.packs),
  routing: storedRouting(row.routing),
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
})

/** The settings as saved; the defaults (300 a day, 12 months, no pack, no routing) before any save. */
export async function aiCreditSettingsOf(container: Container): Promise<AiCreditPlatformSettings> {
  return settingsOf(await aiCreditsIn(container).platformSettings())
}

/** The packs a shop may ask for. */
export const activePacks = (settings: AiCreditPlatformSettings): AiCreditPack[] =>
  settings.packs
    .filter((pack) => pack.active)
    .map(({ id, name, credits, amount, currency }) => ({ id, name, credits, amount, currency }))

const refuse = (key: string) => new MedusaError(MedusaError.Types.INVALID_DATA, key)

const newPackId = () => `pack_${randomBytes(8).toString("hex")}`

/**
 * The packs as given, checked: at most 10; a kept pack named by its id
 * (`cp.ai_pack_unknown` for an id never made here, `cp.ai_pack_duplicate`
 * for one named twice), a new one given a new id; the currency is TRY.
 */
function checkedPacks(given: readonly AiPackInput[], kept: readonly AiPackSetting[]) {
  if (given.length > AI_PACKS_MAX) {
    throw refuse("cp.ai_packs_too_many")
  }
  const seen = new Set<string>()
  return given.map((pack): AiPackSetting => {
    if (pack.id !== undefined) {
      if (!kept.some((each) => each.id === pack.id)) {
        throw refuse("cp.ai_pack_unknown")
      }
      if (seen.has(pack.id)) {
        throw refuse("cp.ai_pack_duplicate")
      }
      seen.add(pack.id)
    }
    const parsed = storedPack.safeParse({
      id: pack.id ?? newPackId(),
      name: pack.name,
      credits: pack.credits,
      amount: pack.amount,
      currency: AI_CREDIT_CURRENCY,
      active: pack.active,
    })
    if (!parsed.success) {
      throw refuse("cp.ai_pack_invalid")
    }
    return parsed.data
  })
}

/**
 * The owner's change saved (adr/0085 §5): checked, merged over what is
 * kept, one transaction on the locked row. Before and after come back
 * for the audit row.
 */
export async function saveAiCreditSettings(
  container: Container,
  change: AiSettingsChange,
  actor: string
): Promise<{ before: AiCreditPlatformSettings; after: AiCreditPlatformSettings }> {
  const routing = change.routing === undefined ? undefined : checkedRouting(change.routing)
  const { before, after } = await aiCreditsIn(container).changePlatformSettings((row) => {
    const kept = settingsOf(row)
    return {
      daily_cap: change.daily_cap ?? kept.dailyCap,
      purchased_lifetime_months: change.purchased_lifetime_months ?? kept.lifetimeMonths,
      packs: change.packs === undefined ? kept.packs : checkedPacks(change.packs, kept.packs),
      routing: routing ?? kept.routing,
    }
  }, actor)
  return { before: settingsOf(before), after: settingsOf(after) }
}

/**
 * Every routing to `service` taken out (its key destroyed: nothing may
 * route to a service the platform holds no key for). The capabilities it
 * ran come back; none, and nothing was written.
 */
export async function unrouteService(
  container: Container,
  service: string,
  actor: string
): Promise<string[]> {
  const kept = await aiCreditSettingsOf(container)
  if (!Object.values(kept.routing).some((route) => route.service === service)) {
    return []
  }
  let removed: string[] = []
  await aiCreditsIn(container).changePlatformSettings((row) => {
    const current = settingsOf(row)
    const routing: AiRouting = {}
    removed = []
    for (const [capability, route] of Object.entries(current.routing)) {
      if (route.service === service) {
        removed.push(capability)
      } else {
        routing[capability as keyof AiRouting] = route
      }
    }
    return {
      daily_cap: current.dailyCap,
      purchased_lifetime_months: current.lifetimeMonths,
      packs: current.packs,
      routing,
    }
  }, actor)
  return removed
}
