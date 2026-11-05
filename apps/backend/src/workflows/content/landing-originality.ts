import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { keptOutOfSearch, originality } from "../../lib/content/originality"
import type { Fingerprint } from "../../lib/content/originality"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { SEO_REDIRECTS_MODULE } from "../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../modules/seo-redirects/service"
import { SEO_SITEMAPS_MODULE } from "../../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../../modules/seo-sitemaps/service"

/** One lock for what writes landing pages: one handle per category, each text measured against the rest. */
export const LANDINGS_LOCK = { key: "landings", timeout: 10, ttl: 60 }

export interface MeasuredLanding {
  id: string
  status: string
  text_live_at: Date | string | null
  fingerprint_size: number
  fingerprint: unknown
  originality: number
}

export const printOf = (row: MeasuredLanding): Fingerprint => ({
  size: row.fingerprint_size,
  signature: row.fingerprint as number[],
})

/** When the page's text went live; a page not live comes after every live one. */
export const liveAtOf = (row: Pick<MeasuredLanding, "status" | "text_live_at">): number =>
  row.status === "published" && row.text_live_at
    ? new Date(row.text_live_at).getTime()
    : Number.POSITIVE_INFINITY

/**
 * A text's own share, 0–100 (docs/14 L-UNIQ-01), against the live pages
 * whose text went live before `liveAt`: the first page live with a text
 * owns it, and a later copy lowers only the copy's share.
 */
export function shareAmong(
  own: Fingerprint,
  liveAt: number,
  id: string | null,
  rows: readonly MeasuredLanding[]
): number {
  const earlier = rows.filter(
    (row) => row.id !== id && row.status === "published" && liveAtOf(row) < liveAt
  )
  return originality(own, earlier.map(printOf))
}

/** The landing pages' fingerprints and standing, `filters` applied. */
export async function measuredLandings(
  container: MedusaContainer,
  filters: Record<string, unknown> = {}
): Promise<MeasuredLanding[]> {
  return container.resolve<ContentModuleService>(CONTENT_MODULE).listLandingPages(filters, {
    select: ["id", "status", "text_live_at", "fingerprint_size", "fingerprint", "originality"],
  })
}

/**
 * Measures every landing page again (docs/14 L-UNIQ-01), the way a save
 * does: a page that went off the shop, or whose text changed since, no
 * longer counts against the pages after it. The shares that changed are
 * written without touching the pages' `updated_at`. A page crossing the
 * noindex line (adr/0019 Ek 2026-11-05) changes what its path answers:
 * cached answers are forgotten and the sitemap waits for its refresh.
 * Returns how many changed.
 */
export async function refreshLandingOriginality(container: MedusaContainer): Promise<number> {
  return container.resolve(Modules.LOCKING).execute(
    LANDINGS_LOCK.key,
    async () => {
      const rows = await measuredLandings(container)
      const live = rows.filter((row) => row.status === "published")
      const changed = rows.flatMap((row) => {
        const share = shareAmong(printOf(row), liveAtOf(row), row.id, live)
        return share === row.originality
          ? []
          : [{ id: row.id, originality: share, was: row.originality }]
      })
      await container
        .resolve<ContentModuleService>(CONTENT_MODULE)
        .setLandingOriginality(changed.map(({ id, originality }) => ({ id, originality })))
      if (changed.some((row) => keptOutOfSearch(row.originality) !== keptOutOfSearch(row.was))) {
        await Promise.all([
          container
            .resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
            .invalidateResolutions(),
          container.resolve<SeoSitemapsModuleService>(SEO_SITEMAPS_MODULE).markDirty(),
        ])
      }
      return changed.length
    },
    { timeout: LANDINGS_LOCK.timeout }
  )
}
