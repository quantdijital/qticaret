import type { MedusaContainer } from "@medusajs/framework/types"
import { containsPattern } from "../../../../lib/security"
import { SEO_REDIRECTS_MODULE } from "../../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../../modules/seo-redirects/service"
import { followPath } from "../../../../workflows/seo/redirects/resolve"
import { suggestTargets } from "../../../../workflows/seo/redirects/suggest"
import type { AdminGetNotFoundType } from "../redirects/validators"

const ORDERS = {
  hits: { hits: "DESC", last_seen_at: "DESC" },
  recent: { last_seen_at: "DESC" },
} as const

/**
 * The 404 log (docs/13 §4): paths visitors asked for and did not find,
 * most asked first. A path a rule or a page answers now says where it
 * goes; the others get likely targets for a one-click 301.
 */
export async function readNotFound(container: MedusaContainer, query: AdminGetNotFoundType) {
  const service = container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
  const search = query.q?.toLowerCase()
  const [rows, count] = await service.listAndCountSeoNotFounds(
    search ? { path: { $ilike: containsPattern(search) } } : {},
    { skip: query.offset, take: query.limit, order: ORDERS[query.order] }
  )
  const entries = await Promise.all(
    rows.map(async (row) => {
      const { resolution } = await followPath(
        container,
        { path: row.path, query: new URLSearchParams() },
        { countHits: false }
      )
      const open = resolution.type === "not_found"
      return {
        id: row.id,
        path: row.path,
        hits: row.hits,
        first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at,
        last_referer_host: row.last_referer_host,
        answer: resolution.type,
        location: resolution.type === "redirect" ? resolution.location : null,
        suggestions: open ? await suggestTargets(container, row.path) : [],
      }
    })
  )
  return { entries, count, offset: query.offset, limit: query.limit }
}
