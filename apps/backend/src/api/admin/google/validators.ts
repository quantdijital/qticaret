import { z } from "@medusajs/framework/zod"
import { HIDE_REASONS } from "../../../modules/google-reviews/models/google-review"
import type { HideReason } from "../../../modules/google-reviews/models/google-review"

/** The shop's Merchant Center account number. */
export const AdminPostGoogleMerchant = z
  .object({
    merchant_id: z
      .string()
      .trim()
      .regex(/^\d{1,20}$/, "google.merchant_id_invalid"),
  })
  .strict()
export type AdminPostGoogleMerchantType = z.infer<typeof AdminPostGoogleMerchant>

/** What Google sends back to the callback: a code, or a refusal; with the state. */
export const GoogleCallbackQuery = z.object({
  state: z.string().max(200).optional(),
  code: z.string().max(2000).optional(),
  error: z.string().max(100).optional(),
})
export type GoogleCallbackQueryType = z.infer<typeof GoogleCallbackQuery>

/** The shop's Search Console property: a domain or a URL prefix, as Search Console writes it. */
export const AdminPostSearchConsoleSite = z.object({ site: z.string().trim().max(300) }).strict()
export type AdminPostSearchConsoleSiteType = z.infer<typeof AdminPostSearchConsoleSite>

/** The Business Profile location whose Google reviews the storefront shows (adr/0058). */
export const AdminPostGoogleReviewLocation = z
  .object({
    account: z.string().regex(/^accounts\/[\w-]{1,64}$/, "google.location_invalid"),
    location: z.string().regex(/^locations\/[\w-]{1,64}$/, "google.location_invalid"),
  })
  .strict()
export type AdminPostGoogleReviewLocationType = z.infer<typeof AdminPostGoogleReviewLocation>

/** The Google reviews kept, twenty a page, for the panel. */
export const AdminGetGoogleReviews = z
  .object({ offset: z.coerce.number().int().min(0).max(100_000).default(0) })
  .strict()
export type AdminGetGoogleReviewsType = z.infer<typeof AdminGetGoogleReviews>

/**
 * One Google review taken off the storefront, or put back (adr/0058 Ek):
 * off only with one of the three reasons, never by its stars; back without
 * one. One review a call: no list of ids, no filter.
 */
export const AdminPostGoogleReview = z
  .object({
    hidden: z.boolean(),
    // Read as text and checked below: Medusa words an enum's refusal itself, not by our key
    reason: z.string().max(40).optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.hidden && body.reason === undefined) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "google.hide_reason_required" })
    }
    if (body.hidden && body.reason !== undefined && !isHideReason(body.reason)) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "google.hide_reason_invalid" })
    }
    if (!body.hidden && body.reason !== undefined) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "google.hide_reason_unexpected" })
    }
  })
export type AdminPostGoogleReviewType = z.infer<typeof AdminPostGoogleReview>

/** One of the three reasons a Google review may leave the storefront for. */
export const isHideReason = (value: string): value is HideReason =>
  (HIDE_REASONS as readonly string[]).includes(value)

/** The storefront's Google reviews block: Google's average and count, the newest reviews. */
export const StoreGetGoogleReviews = z
  .object({ limit: z.coerce.number().int().min(1).max(20).default(6) })
  .strict()
export type StoreGetGoogleReviewsType = z.infer<typeof StoreGetGoogleReviews>
