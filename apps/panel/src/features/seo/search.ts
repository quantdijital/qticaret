import { z } from "zod"
import { REDIRECT_MATCHES } from "./api/redirects"

export const REDIRECT_TABS = ["rules", "old", "missing"] as const
export type RedirectTab = (typeof REDIRECT_TABS)[number]

/** The redirects screen's URL: `/seo/redirects?tab=missing&q=kupa&page=2` (1-based in the URL). */
export const redirectsSearchSchema = z.object({
  tab: z.enum(REDIRECT_TABS).optional().catch(undefined),
  q: z.string().max(200).optional().catch(undefined),
  match: z.enum(REDIRECT_MATCHES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})
export type RedirectsSearch = z.infer<typeof redirectsSearchSchema>
