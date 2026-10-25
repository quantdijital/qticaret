import { normalizePath, parseSource } from "../../../../lib/seo/redirects"
import type { RedirectMatch } from "../../../../lib/seo/redirects"
import { SEO_REDIRECTS_MODULE } from "../../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../../modules/seo-redirects/service"
import type { SeoRedirectRecord } from "../../../../modules/seo-redirects/service"
import { URL_REGISTRY_MODULE } from "../../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../../modules/url-registry/service"
import { CATALOG_LOCALE } from "../../../../workflows/catalog/entity-paths"
import type { AuditedResource, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * Redirect rules and released paths (adr/0017, adr/0011): where a path
 * sent visitors, before and after. A new rule is found by its source, as
 * the body gives it; an import is recorded by its fields only (a thousand
 * rows are not a field-by-field change).
 */

const redirects = (scope: Resolver) =>
  scope.resolve(SEO_REDIRECTS_MODULE) as SeoRedirectsModuleService

const ruleSnapshot = (rule: SeoRedirectRecord | undefined): Snapshot =>
  rule
    ? {
        source: rule.source,
        match: rule.match,
        target: rule.target,
        status: rule.status,
        query_policy: rule.query_policy,
        query_keep: (rule.query_keep ?? []).join(","),
      }
    : {}

async function ruleById(scope: Resolver, id: string): Promise<Snapshot> {
  const [rule] = await redirects(scope).listSeoRedirects({ id }, { take: 1 })
  return ruleSnapshot(rule)
}

async function ruleByBody(scope: Resolver, body: unknown): Promise<Snapshot> {
  const { source, match } = (body ?? {}) as { source?: unknown; match?: unknown }
  const kind = (typeof match === "string" ? match : "exact") as RedirectMatch
  const parsed = typeof source === "string" ? parseSource(source, kind) : null
  if (!parsed?.ok) {
    return {}
  }
  const [rule] = await redirects(scope).listSeoRedirects(
    { source: parsed.value, match: kind },
    { take: 1 }
  )
  return ruleSnapshot(rule)
}

async function pathSnapshot(scope: Resolver, body: unknown): Promise<Snapshot> {
  const { path } = (body ?? {}) as { path?: unknown }
  const normalized = typeof path === "string" ? normalizePath(path) : null
  if (!normalized) {
    return {}
  }
  const registry = scope.resolve(URL_REGISTRY_MODULE) as UrlRegistryModuleService
  const [entry] = await registry.listUrlEntries(
    { locale: CATALOG_LOCALE, path: normalized },
    { take: 1 }
  )
  return entry
    ? { path: entry.path, status: entry.status, owner: `${entry.entity_type}:${entry.entity_id}` }
    : {}
}

export const REDIRECT_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/seo/redirects",
    pattern: /^\/admin\/seo\/redirects$/i,
    resourceType: "seo_redirect",
    resourceId: () => null,
    snapshot: ({ scope, body }) => ruleByBody(scope, body),
  },
  ...(["POST", "DELETE"] as const).map((method) => ({
    method,
    route: `${method} /admin/seo/redirects/:id`,
    pattern: new RegExp(`^/admin/seo/redirects/(?<id>${ID})$`, "i"),
    resourceType: "seo_redirect",
    resourceId: (params: Record<string, string>) => params["id"] ?? null,
    snapshot: ({ scope, params }: { scope: Resolver; params: Record<string, string> }) =>
      ruleById(scope, params["id"] ?? ""),
  })),
  {
    method: "POST",
    route: "POST /admin/seo/old-paths/release",
    pattern: /^\/admin\/seo\/old-paths\/release$/i,
    resourceType: "url_path",
    resourceId: () => null,
    snapshot: ({ scope, body }) => pathSnapshot(scope, body),
  },
]
