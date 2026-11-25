import { z } from "zod"
import {
  AI_CREDIT_ORDER_STATUSES,
  AI_TARGET_CAPABILITIES,
  PAYMENT_METHODS,
  aiCreditPackSchema,
} from "@qticaret/types/control-plane"

/**
 * The AI credits' staff routes (adr/0085 §5) as this panel reads them:
 * each answer checked before a screen shows it. The shared shapes (a
 * pack, the order statuses, the capabilities) come from
 * `@qticaret/types`; the staff views exist only here. A provider's key
 * is never in any of them: what is shown of one is whether it is held.
 */

const day = z.string().min(1)
const count = z.number().int()

/** `GET /admin/cp/tenants/:id/ai-credits`: the wallet as it stands and a page of its ledger. */
export const walletSchema = z.object({
  balance: z.object({
    plan: z.object({ balance: count, period: z.string(), renewsOn: day }),
    purchased: z.object({ balance: count, expiresAt: day.nullable() }),
    daily: z.object({ cap: count, spent: count, remaining: count }),
  }),
  own_daily_cap: count.nullable(),
  // P3d, so the tab reads no other route; each absent from an older control
  // plane, and the tab then says nothing of what it does not know
  /** The plan has `ai.platform_credits` on, whatever the shop's status. */
  flag_on: z.boolean().optional(),
  tenant_status: z.string().optional(),
  /** The month's whole grant (not what is left of it). */
  monthly_grant: count.optional(),
  entries: z.array(
    z.object({
      id: z.string(),
      // The control plane's kinds; one this panel does not know yet is shown by its name
      kind: z.string(),
      amount: count,
      bucket: z.enum(["plan", "purchased"]),
      note: z.string().nullable(),
      actor: z.string(),
      // The staff member's name beside their id (P3d); null for the system, the
      // shop, or one since removed; absent from a control plane before P3d
      actor_name: z.string().nullable().optional(),
      created_at: day,
    })
  ),
  count,
  limit: count,
  offset: count,
})
export type AiWallet = z.infer<typeof walletSchema>
export type AiLedgerEntry = AiWallet["entries"][number]

/**
 * A request's shop as the shops' list names it (P3d): null for a shop no
 * longer listed; absent from a control plane older than P3d. Either way
 * the screens fall back to the shop's id.
 */
const orderShopSchema = z.object({
  name: z.string(),
  slug: z.string().optional(),
  primary_hostname: z.string().nullable().optional(),
})

export const orderSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  tenant: orderShopSchema.nullable().optional(),
  pack: aiCreditPackSchema,
  status: z.enum(AI_CREDIT_ORDER_STATUSES),
  method: z.enum(PAYMENT_METHODS).nullable(),
  reference: z.string().nullable(),
  requested_at: day,
  decided_at: day.nullable(),
})
export type AiOrder = z.infer<typeof orderSchema>

/** `GET /admin/cp/ai/orders`: newest first. */
export const ordersSchema = z.object({
  orders: z.array(orderSchema),
  count,
  limit: count,
  offset: count,
})
export type AiOrderList = z.infer<typeof ordersSchema>

const routeSchema = z.object({ service: z.string(), model: z.string() })

export const packSettingSchema = aiCreditPackSchema.extend({ active: z.boolean() })
export type AiPackSetting = z.infer<typeof packSettingSchema>

/** `GET /admin/cp/ai/settings`: the settings and what may be routed (service → capability → models). */
export const settingsSchema = z.object({
  settings: z.object({
    daily_cap: count,
    purchased_lifetime_months: count,
    packs: z.array(packSettingSchema),
    routing: z.partialRecord(z.enum(AI_TARGET_CAPABILITIES), routeSchema),
    updated_at: day.nullable(),
    updated_by: z.string().nullable(),
  }),
  targets: z.array(
    z.object({
      service: z.string(),
      capabilities: z.partialRecord(z.enum(AI_TARGET_CAPABILITIES), z.array(z.string())),
    })
  ),
})
export type AiSettingsAnswer = z.infer<typeof settingsSchema>
export type AiSettings = AiSettingsAnswer["settings"]
export type AiRouting = AiSettings["routing"]

/** `GET /admin/cp/ai/providers`: held or not, its version and when; never the key. */
export const providersSchema = z.object({
  providers: z.array(
    z.object({
      service: z.string(),
      has_key: z.boolean(),
      version: count.nullable(),
      written_at: day.nullable(),
      routed: z.array(z.string()),
    })
  ),
})
export type AiProvider = z.infer<typeof providersSchema>["providers"][number]

export const CHECK_REASONS = ["no_key", "rejected", "unreachable", "timeout", "unexpected"] as const
export type AiCheckReason = (typeof CHECK_REASONS)[number]

/** "Bağlantıyı dene": the verdict alone, nothing of the provider's. */
export const checkSchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), reason: z.enum(CHECK_REASONS) }),
])
export type AiCheck = z.infer<typeof checkSchema>

/** A key written or deleted: whether one is held now (never the key). */
export const providerAnswerSchema = z.object({
  provider: z.object({ service: z.string(), has_key: z.boolean() }),
})

export const adjustAnswerSchema = z.object({ applied: z.boolean() })
export const dailyCapAnswerSchema = z.object({ own_daily_cap: count.nullable() })
export const orderAnswerSchema = z.object({ order: orderSchema })
/** "Ödendi": `applied: false` when it had been marked paid already (nothing added twice). */
export const paidAnswerSchema = z.object({ applied: z.boolean(), order: orderSchema })
