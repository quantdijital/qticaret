import type { MedusaContainer } from "@medusajs/framework/types"
import { ConflictError, ValidationError } from "../../../lib/errors"
import {
  compilePattern,
  matchPattern,
  parseRequestPath,
  parseSource,
  parseTarget,
  REDIRECT_LIMITS,
  splitTarget,
} from "../../../lib/seo/redirects"
import type {
  Checked,
  QueryPolicy,
  RedirectMatch,
  RedirectRule,
  RedirectStatus,
} from "../../../lib/seo/redirects"
import { SEO_REDIRECTS_MODULE } from "../../../modules/seo-redirects"
import { MAX_PATTERN_RULES } from "../../../modules/seo-redirects/service"
import type SeoRedirectsModuleService from "../../../modules/seo-redirects/service"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../modules/url-registry/service"
import { CATALOG_LOCALE } from "../../catalog/entity-paths"
import { ownerState } from "./owners"
import { followPath } from "./resolve"

/** A rule as the panel, an import row or a migration sends it. */
export interface RedirectInput {
  source: string
  match: RedirectMatch
  target?: string | null | undefined
  status: RedirectStatus
  query_policy: QueryPolicy
  query_keep?: string[] | null | undefined
}

/** The row to write: stored forms, the chain already followed. */
export interface RedirectFields {
  source: string
  match: RedirectMatch
  target: string | null
  status: RedirectStatus
  query_policy: QueryPolicy
  query_keep: string[] | null
}

/** A rule that pointed at the new rule's source, now sent to its end (docs/13 §4). */
export interface Retarget {
  id: string
  target: string
  previous: string
}

function checked<T>(result: Checked<T>, field: string): T {
  if (!result.ok) {
    throw new ValidationError(result.key, { field })
  }
  return result.value
}

// Parameter names as forms and trackers write them (`utm_source`, `filter[renk]`)
const PARAM_NAME = /^[\w.[\]-]{1,64}$/

function queryKeep(names: readonly string[]): string[] {
  const unique = [...new Set(names)]
  if (
    unique.length === 0 ||
    unique.length > REDIRECT_LIMITS.keepList ||
    !unique.every((name) => PARAM_NAME.test(name))
  ) {
    throw new ValidationError("seo.redirect_query_invalid", { field: "query_keep" })
  }
  return unique
}

/** A stored rule's fields, for a compensation or an update that keeps them. */
export const fieldsOfRule = (rule: RedirectRule): RedirectFields => ({
  source: rule.source,
  match: rule.match,
  target: rule.target,
  status: rule.status,
  query_policy: rule.query_policy,
  query_keep: rule.query_keep ? [...rule.query_keep] : null,
})

/** Source and target in stored form; no live checks yet. */
export function storedFields(input: RedirectInput): RedirectFields {
  const source = checked(parseSource(input.source, input.match), "source")
  const target = checked(
    parseTarget(input.target, { source, match: input.match, status: input.status }),
    "target"
  )
  return {
    source,
    match: input.match,
    target,
    status: input.status,
    query_policy: input.query_policy,
    query_keep: input.query_policy === "keep_list" ? queryKeep(input.query_keep ?? []) : null,
  }
}

// Whether the new rule would take a request the chain goes through
function takes(fields: RedirectFields, path: string): boolean {
  if (fields.match === "exact") {
    return path === fields.source
  }
  if (fields.match === "prefix") {
    return path === fields.source || path.startsWith(`${fields.source}/`)
  }
  const pattern = compilePattern(fields.source)
  return pattern !== null && matchPattern(pattern, path) !== null
}

// Joining two hops keeps a temporary one temporary: a permanent rule is not
// flattened through a 302, nor a 302 written over a permanent rule's target
const keepsPermanence = (outer: number, inner: number): boolean => inner === 301 || inner === outer

// A pattern's target is followed with a stand-in for its placeholders
const followable = (target: string): string =>
  target
    .split("/")
    .map((part) => (part === "*" || part.startsWith(":") ? "x" : part))
    .join("/")

/**
 * The checks that need the shop's data (adr/0017):
 * - an exact rule may not take a live page's path (it would never answer);
 * - a target that is itself an exact redirect is replaced by that rule's
 *   target, so the new rule is stored flat;
 * - following the target may not come back to the rule (a loop) nor end
 *   at a page that is gone.
 */
export async function checkAgainstShop(
  container: MedusaContainer,
  fields: RedirectFields,
  ruleId: string | null
): Promise<RedirectFields> {
  const redirects = container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  if (fields.match === "exact") {
    const entry = await registry.resolvePath({ locale: CATALOG_LOCALE, path: fields.source })
    if (entry?.status === "active" && (await ownerState(container, entry)).kind === "live") {
      throw new ValidationError("seo.redirect_source_live", { field: "source" })
    }
  }
  if (fields.target === null) {
    return fields
  }
  let target = fields.target
  const { path, query } = splitTarget(target)
  if (!query) {
    const [next] = await redirects.listSeoRedirects({ match: "exact", source: path }, { take: 1 })
    if (
      next &&
      next.id !== ruleId &&
      next.target !== null &&
      keepsPermanence(fields.status, next.status) &&
      !takes(fields, splitTarget(next.target).path)
    ) {
      target = next.target
    }
  }
  const request = parseRequestPath(followable(target))
  if (request) {
    const { resolution, visited } = await followPath(container, request, { countHits: false })
    if (visited.some((each) => takes(fields, each))) {
      throw new ValidationError("seo.redirect_loop", { field: "target" })
    }
    if (resolution.type === "gone") {
      throw new ValidationError("seo.redirect_target_gone", { field: "target" })
    }
  }
  return { ...fields, target }
}

/** Another rule with the same source and kind, or one pattern too many. */
export async function checkRuleSet(
  container: MedusaContainer,
  fields: RedirectFields,
  ruleId: string | null
): Promise<void> {
  const redirects = container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
  const [same] = await redirects.listSeoRedirects(
    { source: fields.source, match: fields.match },
    { take: 1, select: ["id"] }
  )
  if (same && same.id !== ruleId) {
    throw new ConflictError("seo.redirect_exists")
  }
  if (fields.match === "pattern") {
    const patterns = await redirects.listSeoRedirects({ match: "pattern" }, { select: ["id"] })
    if (patterns.filter((rule) => rule.id !== ruleId).length >= MAX_PATTERN_RULES) {
      throw new ValidationError("seo.redirect_pattern_limit", { field: "match" })
    }
  }
}

/**
 * Rules that sent visitors to the new rule's source now go straight to
 * its target, so no chain is stored (A→B, then B→C: A→C). Only plain path
 * targets are rewritten; a pattern's or a query's target stays.
 */
export async function retargets(
  container: MedusaContainer,
  fields: RedirectFields,
  ruleId: string | null
): Promise<Retarget[]> {
  if (fields.match !== "exact" || fields.target === null) {
    return []
  }
  const redirects = container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
  const pointing = await redirects.listSeoRedirects(
    { target: fields.source },
    { select: ["id", "target", "status"] }
  )
  const target = fields.target
  return pointing
    .filter(
      (rule) =>
        rule.id !== ruleId && rule.status !== 410 && keepsPermanence(rule.status, fields.status)
    )
    .map((rule) => ({ id: rule.id, target, previous: rule.target ?? fields.source }))
}
