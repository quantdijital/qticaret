import type { MedusaContainer } from "@medusajs/framework/types"
import { containsPattern } from "../../../../lib/security"
import { SEO_REDIRECTS_MODULE } from "../../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../../modules/seo-redirects/service"
import type { SeoRedirectRecord } from "../../../../modules/seo-redirects/service"
import { URL_REGISTRY_MODULE } from "../../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../../modules/url-registry/service"
import { CATALOG_LOCALE } from "../../../../workflows/catalog/entity-paths"
import type { AdminGetRedirectsType } from "./validators"

export const presentRedirect = (rule: SeoRedirectRecord) => ({
  id: rule.id,
  source: rule.source,
  match: rule.match,
  target: rule.target,
  status: rule.status,
  query_policy: rule.query_policy,
  query_keep: rule.query_keep ?? [],
  origin: rule.origin,
  hit_count: rule.hit_count,
  last_hit_at: rule.last_hit_at,
  created_at: rule.created_at,
  updated_at: rule.updated_at,
})

const ORDERS = {
  recent: { created_at: "DESC" },
  hits: { hit_count: "DESC", created_at: "DESC" },
  source: { source: "ASC" },
} as const

/**
 * A page of rules (adr/0017). An exact rule whose source a product or
 * category took later is marked `shadowed`: the live page wins, so the
 * rule no longer answers.
 */
export async function readRedirects(container: MedusaContainer, query: AdminGetRedirectsType) {
  const service = container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
  const search = query.q?.toLowerCase()
  const [rows, count] = await service.listAndCountSeoRedirects(
    {
      ...(query.match ? { match: query.match } : {}),
      ...(query.origin ? { origin: query.origin } : {}),
      ...(search
        ? {
            $or: [
              { source: { $ilike: containsPattern(search) } },
              { target: { $ilike: containsPattern(search) } },
            ],
          }
        : {}),
    },
    { skip: query.offset, take: query.limit, order: ORDERS[query.order] }
  )
  const exact = rows.filter((rule) => rule.match === "exact").map((rule) => rule.source)
  const held = exact.length
    ? await container
        .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
        .listUrlEntries(
          { locale: CATALOG_LOCALE, path: exact, status: "active" },
          { select: ["path"] }
        )
    : []
  const shadowed = new Set(held.map((entry) => entry.path))
  return {
    redirects: rows.map((rule) => ({
      ...presentRedirect(rule),
      shadowed: rule.match === "exact" && shadowed.has(rule.source),
    })),
    count,
    offset: query.offset,
    limit: query.limit,
  }
}
