import { z } from "zod"
import { parseMoneyInput } from "@/lib/money-input"
import { applicationMethod, offerKind } from "./offer"
import type { OfferKind } from "./offer"
import type { Promotion } from "./api/promotions"

/** The promotion form; messages are i18n keys. Dates are whole Istanbul days. */
export const promotionSchema = z
  .object({
    kind: z.enum(["percentage", "fixed", "free_shipping"]),
    value: z.string().trim(),
    code: z
      .string()
      .trim()
      .min(3, { message: "promotions.errors.code" })
      .max(40, { message: "promotions.errors.code" })
      .regex(/^[A-Za-z0-9_-]+$/, { message: "promotions.errors.code" }),
    automatic: z.boolean(),
    limit: z
      .string()
      .trim()
      .regex(/^\d{0,7}$/, { message: "promotions.errors.limit" }),
    starts: z.string(),
    ends: z.string(),
    activate: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const amount = parseMoneyInput(values.value) ?? 0
    if (values.kind === "percentage" && !(amount > 0 && amount <= 100)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "promotions.errors.percentage" })
    }
    if (values.kind === "fixed" && !(amount > 0)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "promotions.errors.amount" })
    }
    if (values.starts && values.ends && values.ends < values.starts) {
      ctx.addIssue({ code: "custom", path: ["ends"], message: "promotions.errors.dates" })
    }
  })

export type PromotionValues = z.infer<typeof promotionSchema>

// The day's first and last second in Turkey (UTC+3, no summer time)
export const dayStart = (day: string) => (day ? new Date(`${day}T00:00:00+03:00`) : null)
export const dayEnd = (day: string) => (day ? new Date(`${day}T23:59:59+03:00`) : null)
const dayOf = (when: string | Date | null | undefined) =>
  when ? new Date(new Date(when).getTime() + 3 * 3_600_000).toISOString().slice(0, 10) : ""

export function valuesOf(promotion: Promotion | null): PromotionValues {
  const method = promotion?.application_method
  const kind: OfferKind = promotion ? offerKind(method) : "percentage"
  return {
    kind,
    value: kind === "free_shipping" || !method?.value ? "" : String(method.value).replace(".", ","),
    code: promotion?.code ?? "",
    automatic: promotion?.is_automatic ?? false,
    limit: promotion?.limit ? String(promotion.limit) : "",
    starts: dayOf(promotion?.campaign?.starts_at),
    ends: dayOf(promotion?.campaign?.ends_at),
    activate: true,
  }
}

/** A campaign's identifier must be unique, and a deleted promotion leaves its campaign behind. */
export const campaignIdentifier = (code: string, suffix: string = Date.now().toString(36)) =>
  `${code}-${suffix}`.toUpperCase()

/** The body for a new promotion; dates come on a campaign of its own. */
export function createBody(values: PromotionValues, currency: string, suffix?: string) {
  const code = values.code.trim().toUpperCase()
  const dated = Boolean(values.starts || values.ends)
  return {
    code,
    type: "standard" as const,
    is_automatic: values.automatic,
    // Shop prices include KDV, so an amount off does too
    is_tax_inclusive: true,
    status: values.activate ? ("active" as const) : ("draft" as const),
    limit: values.automatic || !values.limit ? null : Number(values.limit),
    application_method: applicationMethod(
      values.kind,
      parseMoneyInput(values.value) ?? 0,
      currency
    ),
    ...(dated
      ? {
          campaign: {
            name: code,
            campaign_identifier: campaignIdentifier(code, suffix),
            starts_at: dayStart(values.starts),
            ends_at: dayEnd(values.ends),
          },
        }
      : {}),
  }
}
