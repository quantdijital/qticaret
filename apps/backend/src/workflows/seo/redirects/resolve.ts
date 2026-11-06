import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../../../lib/logging"
import {
  encodePath,
  isBackendPath,
  locationOf,
  parseRequestPath,
  pickRule,
} from "../../../lib/seo/redirects"
import type { RedirectStatus, RequestPath } from "../../../lib/seo/redirects"
import { SEO_REDIRECTS_MODULE } from "../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../modules/seo-redirects/service"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../modules/url-registry/service"
import type { ResolvedPath } from "../../../modules/url-registry/service"
import type { SeoPayload } from "../../../lib/seo/resolve"
import { SALE_PATH } from "../../../lib/seo/url-patterns"
import { SALE_LISTING } from "../../pricing/sale-products"
import { CATALOG_LOCALE } from "../../catalog/entity-paths"
import { pageWithQuery, redirectThroughListing } from "../listing-resolution"
import type { ListingView } from "../listing-resolution"
import { legacyResolution } from "./legacy"
import type { Follow } from "./legacy"
import { activePathOf, ownerState, successorPath } from "./owners"
import type { OwnerState } from "./owners"

export type RedirectCode = Exclude<RedirectStatus, 410>

/**
 * What the storefront does with a path (docs/13 §4, `GET /store/seo/resolve`):
 * a live page comes with its `seo` object (adr/0015).
 */
export type Resolution =
  | {
      type: "entity"
      path: string
      entity_type: string
      entity_id: string
      seo?: SeoPayload | null
      /** A listing's filters, price range, sort and page as its query gave them (F3.17). */
      listing?: ListingView
    }
  | { type: "redirect"; path: string; status: RedirectCode; location: string }
  | { type: "gone"; path: string }
  | { type: "not_found"; path: string | null }

type Answer =
  | { type: "entity"; entity_type: string; entity_id: string }
  | { type: "redirect"; status: RedirectCode; location: string; ruleId?: string }
  | { type: "gone"; ruleId?: string }
  | { type: "not_found" }

// The storefront always gets the end of a chain in one hop; rules saved
// flat seldom need more than two
const MAX_HOPS = 5

const withQuery = (path: string, request: RequestPath): string => {
  const query = request.query.toString()
  return query ? `${encodePath(path)}?${query}` : encodePath(path)
}

/** An old path of a record: its current path, its successor's, or gone (docs/13 §2.4). */
async function ownerAnswer(
  container: MedusaContainer,
  entry: ResolvedPath,
  state: OwnerState,
  request: RequestPath
): Promise<Answer> {
  const path =
    state.kind === "live"
      ? await activePathOf(container, entry)
      : await successorPath(container, state.successorId)
  if (path !== null && path !== request.path) {
    return { type: "redirect", status: 301, location: withQuery(path, request) }
  }
  return state.kind === "deleted" ? { type: "gone" } : { type: "not_found" }
}

/**
 * One hop (adr/0017): the sale page (`/kampanyalar`), a live record's own
 * path, then the rules (exact, longest prefix, patterns), then the URL
 * registry's old paths. A live page always wins, so no rule can hide it.
 */
async function answer(container: MedusaContainer, request: RequestPath): Promise<Answer> {
  // The sale page is the storefront's own (a reserved path), always there
  if (request.path === SALE_PATH) {
    return { type: "entity", entity_type: SALE_LISTING, entity_id: SALE_LISTING }
  }
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const redirects = container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
  const entry = await registry.resolvePath({ locale: CATALOG_LOCALE, path: request.path })
  const state = entry ? await ownerState(container, entry) : null
  if (entry?.status === "active" && state?.kind === "live") {
    return { type: "entity", entity_type: entry.entity_type, entity_id: entry.entity_id }
  }
  const [candidates, patterns] = await Promise.all([
    redirects.candidatesFor(request.path),
    redirects.patternRules(),
  ])
  const match = pickRule(request.path, candidates, patterns)
  if (match) {
    const location = locationOf(match.rule, request, match.params)
    // A prefix's remainder or a pattern's value can spell a backend path
    // (`/eski/admin` under `/eski` → `/`); no rule sends visitors there
    if (location !== null && isBackendPath(location)) {
      return { type: "not_found" }
    }
    return location === null
      ? { type: "gone", ruleId: match.rule.id }
      : {
          type: "redirect",
          status: match.rule.status as RedirectCode,
          location,
          ruleId: match.rule.id,
        }
  }
  return entry && state ? ownerAnswer(container, entry, state, request) : { type: "not_found" }
}

/** Where a path leads, its hits uncounted: what an old address's rule asks (adr/0059). */
const followed =
  (container: MedusaContainer): Follow =>
  async (request, { legacy = true } = {}) =>
    (await followPath(container, request, { countHits: false, legacy })).resolution

export interface Followed {
  resolution: Resolution
  /** Every path the chain went through, the first included (loop checks). */
  visited: string[]
  /** The rules that answered a hop, for their hit counts. */
  ruleIds: string[]
}

/**
 * Follows the chain from `request` to its end, so the storefront answers
 * with one redirect: permanent only when every hop is. A loop (a rule set
 * changed under another) answers not found and is logged. A path nothing
 * here holds may still be an old platform's own address (adr/0059): its
 * rule answers last, unless `legacy` is false.
 */
export async function followPath(
  container: MedusaContainer,
  request: RequestPath,
  { countHits = true, legacy = true }: { countHits?: boolean; legacy?: boolean } = {}
): Promise<Followed> {
  const redirects = container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
  const path = request.path
  const visited = [path]
  const ruleIds: string[] = []
  const done = (resolution: Resolution): Followed => {
    if (countHits) {
      ruleIds.forEach((id) => {
        redirects.recordHit(id)
      })
    }
    return { resolution, visited, ruleIds }
  }
  let current = request
  let redirect: { status: RedirectCode; location: string } | null = null
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const next = await answer(container, current)
    if ("ruleId" in next && next.ruleId) {
      ruleIds.push(next.ruleId)
    }
    if (next.type !== "redirect") {
      if (next.type === "gone") {
        return done({ type: "gone", path })
      }
      if (redirect === null) {
        if (next.type === "entity") {
          return done({ ...next, path })
        }
        const old = legacy ? await legacyResolution(container, request, followed(container)) : null
        return done(old ? { ...old, path } : { type: "not_found", path })
      }
      return done({ type: "redirect", path, ...redirect })
    }
    redirect = {
      status: redirect && redirect.status !== 301 ? redirect.status : next.status,
      location: next.location,
    }
    const target = parseRequestPath(next.location)
    if (target === null) {
      break
    }
    if (visited.includes(target.path)) {
      logger.warn({ event: "seo.redirect_loop", path, visited })
      visited.push(target.path)
      return done({ type: "not_found", path })
    }
    visited.push(target.path)
    current = target
  }
  return done(redirect ? { type: "redirect", path, ...redirect } : { type: "not_found", path })
}

interface CachedAnswer {
  resolution: Resolution
  ruleIds: string[]
}

/**
 * Resolves a storefront path as the storefront sent it (`/eski?utm_source=x`),
 * a live page with its `seo` object. With `cache`, answers are kept per
 * process until anything they depend on changes (at most 30 seconds); a
 * cached redirect still counts its rules' hits.
 */
export async function resolveStorefrontPath(
  container: MedusaContainer,
  raw: string,
  { countHits = true, cache = false }: { countHits?: boolean; cache?: boolean } = {}
): Promise<Resolution> {
  const request = parseRequestPath(raw)
  if (request === null) {
    return { type: "not_found", path: null }
  }
  const redirects = container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
  const slot = cache
    ? await redirects.resolutionSlot(`${request.path}?${request.query.toString()}`)
    : null
  const kept = slot?.value as CachedAnswer | undefined
  if (kept) {
    if (countHits) {
      kept.ruleIds.forEach((id) => {
        redirects.recordHit(id)
      })
    }
    return kept.resolution
  }
  const { resolution, ruleIds } = await followPath(container, request, { countHits })
  const answered =
    resolution.type === "entity"
      ? await pageWithQuery(container, resolution, request)
      : resolution.type === "redirect"
        ? await redirectThroughListing(container, resolution)
        : resolution
  slot?.keep({ resolution: answered, ruleIds } satisfies CachedAnswer)
  return answered
}
