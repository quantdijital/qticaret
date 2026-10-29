import { z } from "@medusajs/framework/zod"
import { FEED_TARGETS } from "../../../lib/feeds/targets"
import type { FeedTarget } from "../../../lib/feeds/targets"
import { defineSection } from "./define"

export interface MarketingSettings {
  /** A shopper who left a cart gets one reminder, with e-mail consent only (F10.7). */
  abandoned_cart_enabled: boolean
  /** Minutes a cart stays unchanged before it counts as left. */
  abandoned_cart_delay_minutes: number
  /** Categories (and those under them) each feed leaves out (F10.8). */
  feed_exclusions: Record<FeedTarget, string[]>
  /** An order placed before this hour leaves the same day, as Akakçe shows it; null: not promised. */
  feed_same_day_cutoff_hour: number | null
}

const categoryIds = z.array(z.string().regex(/^[\w-]{1,64}$/)).max(500)

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
  },
  {
    abandoned_cart_enabled: false,
    abandoned_cart_delay_minutes: 60,
    feed_exclusions: { google: [], meta: [], cimri: [], akakce: [] },
    feed_same_day_cutoff_hour: null,
  }
)
