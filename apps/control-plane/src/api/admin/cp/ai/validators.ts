import { z } from "@medusajs/framework/zod"
import {
  AI_CREDIT_ORDER_STATUSES,
  AI_TARGET_CAPABILITIES,
  PAYMENT_METHODS,
} from "@qticaret/types/control-plane"
import { AI_PACKS_MAX } from "../../../../lib/ai-credits/platform-settings"
import { AI_CREDIT_MOVE_MAX } from "../../../../lib/ai-credits/settings"
import { CLEAN, CLEAN_TEXT } from "../../../../lib/clean-text"
import { DAILY_CAP_MAX } from "../../../../modules/ai-credits/service-settings"

/**
 * What the AI credits' staff routes take (adr/0085 §5), strictly. Credits
 * and kuruş are whole numbers; texts are the control plane's clean lines
 * with P2's limits (note 500, reference 256).
 */

const whole = (min: number, max: number) => z.number().int().min(min).max(max)

const dailyCap = whole(0, DAILY_CAP_MAX)

const pack = z
  .object({
    id: z.string().max(40).optional(),
    name: z.string().trim().min(1, "cp.name_required").max(100).regex(CLEAN, "cp.text_invalid"),
    credits: whole(1, AI_CREDIT_MOVE_MAX),
    // Kuruş; a pack sold for nothing is a staff correction instead
    amount: whole(1, 100_000_000),
    active: z.boolean(),
  })
  .strict()

const route = z
  .object({
    service: z.string().min(1).max(40),
    model: z.string().min(1).max(100),
  })
  .strict()

/** The settings changed: any of them; `routing`, when sent, is the whole of it. */
export const PostAiSettings = z
  .object({
    daily_cap: dailyCap.optional(),
    purchased_lifetime_months: whole(1, 120).optional(),
    packs: z.array(pack).max(AI_PACKS_MAX, "cp.ai_packs_too_many").optional(),
    routing: z.partialRecord(z.enum(AI_TARGET_CAPABILITIES), route.nullable()).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, "cp.nothing_to_save")
export type PostAiSettingsType = z.infer<typeof PostAiSettings>

const PROVIDER_KEY = /^[\x21-\x7e]{8,512}$/

/**
 * A provider's key as the owner pastes it: printable ASCII without spaces,
 * 8 to 512 characters. The refusal never repeats it: one custom check, as
 * the framework's own wording of a wrong type or length quotes the value
 * it got ("Expected type: 'string' …, got: '…'").
 */
export const PostProviderKey = z
  .object({
    api_key: z.custom<string>((value) => typeof value === "string" && PROVIDER_KEY.test(value), {
      error: "cp.ai_key_invalid",
    }),
  })
  .strict()
export type PostProviderKeyType = z.infer<typeof PostProviderKey>

const page = (max: number) => ({
  limit: z.coerce.number().int().min(1).max(max).default(max),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})

/** A shop's ledger, 50 rows a page at most. */
export const GetAiWallet = z.object(page(50)).strict()
export type GetAiWalletType = z.infer<typeof GetAiWallet>

/** The requests, optionally by status. */
export const GetAiOrders = z
  .object({ status: z.enum(AI_CREDIT_ORDER_STATUSES).optional(), ...page(100) })
  .strict()
export type GetAiOrdersType = z.infer<typeof GetAiOrders>

/** "Kredi ekle / düş": an amount other than 0, its bucket, why, and the form's one key. */
export const PostAiAdjust = z
  .object({
    amount: whole(-AI_CREDIT_MOVE_MAX, AI_CREDIT_MOVE_MAX).refine(
      (value) => value !== 0,
      "cp.ai_credit_amount_invalid"
    ),
    bucket: z.enum(["plan", "purchased"]),
    note: z
      .string()
      .trim()
      .min(1, "cp.ai_credit_note_required")
      .max(500)
      .regex(CLEAN_TEXT, "cp.text_invalid"),
    key: z.uuid(),
  })
  .strict()
export type PostAiAdjustType = z.infer<typeof PostAiAdjust>

/** A shop's own day's cap, or null for the platform's. */
export const PostAiDailyCap = z.object({ daily_cap: dailyCap.nullable() }).strict()
export type PostAiDailyCapType = z.infer<typeof PostAiDailyCap>

/** "Ödendi": how it was paid and the receipt's reference. */
export const PostAiOrderPaid = z
  .object({
    method: z.enum(PAYMENT_METHODS),
    reference: z
      .string()
      .trim()
      .max(256)
      .regex(CLEAN, "cp.text_invalid")
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .optional(),
  })
  .strict()
export type PostAiOrderPaidType = z.infer<typeof PostAiOrderPaid>
