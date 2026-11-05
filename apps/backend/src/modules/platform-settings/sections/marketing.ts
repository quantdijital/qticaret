import { z } from "@medusajs/framework/zod"
import { FEED_TARGETS } from "../../../lib/feeds/targets"
import type { FeedTarget } from "../../../lib/feeds/targets"
import { defineSection, isCleanText } from "./define"

export interface MarketingSettings {
  /** A shopper who left a cart gets one reminder, with e-mail consent only (F10.7). */
  abandoned_cart_enabled: boolean
  /** Minutes a cart stays unchanged before it counts as left. */
  abandoned_cart_delay_minutes: number
  /** Categories (and those under them) each feed leaves out (F10.8). */
  feed_exclusions: Record<FeedTarget, string[]>
  /**
   * An order placed before this hour leaves the same day, as Akakçe and the
   * product page's shipping card (adr/0046 Ek 2026-11-06) show it; null: not promised.
   */
  feed_same_day_cutoff_hour: number | null
  /** One bulk message (adr/0050) a recipient in 24 hours at most. */
  campaign_frequency_cap: boolean
  /** Bulk texts go from this hour (TR) ... */
  campaign_sms_start_hour: number
  /** ... until this one; outside, a sending SMS campaign waits (adr/0050 §6). */
  campaign_sms_end_hour: number
  /**
   * How a recipient refuses commercial texts (İYS's opt-out line), added to
   * every bulk SMS; without it no SMS campaign starts (adr/0050 §4).
   */
  sms_opt_out_text: string | null
}

const categoryIds = z.array(z.string().regex(/^[\w-]{1,64}$/)).max(500)

const optOutText = z
  .string()
  .trim()
  .max(80)
  .refine((value) => isCleanText(value), { message: "platform_settings.text_invalid" })
  .transform((value) => (value === "" ? null : value))
  .nullable()

/** What the shop sends to sell more (F10, adr/0038): off until the shop turns it on. */
export const marketingSection = defineSection<MarketingSettings>(
  "marketing",
  {
    abandoned_cart_enabled: z.boolean(),
    abandoned_cart_delay_minutes: z.number().int().min(30).max(1440),
    feed_exclusions: z
      .object(Object.fromEntries(FEED_TARGETS.map((target) => [target, categoryIds])))
      .strict(),
    feed_same_day_cutoff_hour: z.number().int().min(1).max(23).nullable(),
    campaign_frequency_cap: z.boolean(),
    campaign_sms_start_hour: z.number().int().min(0).max(23),
    campaign_sms_end_hour: z.number().int().min(1).max(24),
    sms_opt_out_text: optOutText,
  },
  {
    abandoned_cart_enabled: false,
    abandoned_cart_delay_minutes: 60,
    feed_exclusions: { google: [], meta: [], cimri: [], akakce: [] },
    feed_same_day_cutoff_hour: null,
    campaign_frequency_cap: true,
    campaign_sms_start_hour: 9,
    campaign_sms_end_hour: 20,
    sms_opt_out_text: null,
  },
  (values, ctx) => {
    if (values.campaign_sms_end_hour <= values.campaign_sms_start_hour) {
      ctx.addIssue({
        code: "custom",
        message: "platform_settings.hours_invalid",
        path: ["campaign_sms_end_hour"],
      })
    }
  }
)
