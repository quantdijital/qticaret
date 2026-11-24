import { z } from "zod"
import { REDIRECT_MATCHES } from "./api/redirects"

export const REDIRECT_TABS = ["rules", "old", "missing"] as const
export type RedirectTab = (typeof REDIRECT_TABS)[number]

/** The redirects tab's filters: `/settings/seo?part=redirects&tab=missing&q=kupa&page=2` (1-based). */
export const redirectsSearchSchema = z.object({
  tab: z.enum(REDIRECT_TABS).optional().catch(undefined),
  q: z.string().max(200).optional().catch(undefined),
  match: z.enum(REDIRECT_MATCHES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})
export type RedirectsSearch = z.infer<typeof redirectsSearchSchema>

/** The site search tab's filters: `/settings/seo?part=site-search&q=tisort&page=2` (1-based). */
export const siteSearchSearchSchema = z.object({
  q: z.string().max(200).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})
export type SiteSearchSearch = z.infer<typeof siteSearchSearchSchema>

/**
 * Settings > SEO's URL: its open tab (`part`, an unknown one opens the
 * first) and the open tab's filters, the redirects' and site search's
 * (the same `q` and `page`; changing tabs leaves them behind).
 */
export const seoSearchSchema = redirectsSearchSchema.extend({
  part: z.string().max(40).optional().catch(undefined),
})
export type SeoSearch = z.infer<typeof seoSearchSchema>
