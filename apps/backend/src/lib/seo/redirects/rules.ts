import { isReservedPath } from "../paths"
import { encodePath, isBackendPath, normalizePath } from "./paths"
import { compilePattern, fillPath, matchPattern } from "./patterns"
import type { PatternSegment } from "./patterns"
import { REDIRECT_LIMITS, fail, ok } from "./types"
import type { Checked, QueryPolicy, RedirectMatch, RedirectRule, RedirectStatus } from "./types"
import type { RequestPath } from "./paths"

/**
 * A rule's source and target as they are stored (adr/0017), and the
 * location a rule sends a request to.
 */

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:|^\/\//i

// A whole-segment wildcard in an exact or prefix source is a pattern typed
// under the wrong kind; refused so it does not silently match nothing
const looksLikePattern = (path: string): boolean =>
  path.split("/").some((part) => part === "*" || part.startsWith(":"))

/** Takes the path of an absolute URL (an old site's address, as crawl exports list them). */
function pathOfUrl(raw: string): string | null {
  if (!/^https?:\/\//i.test(raw)) {
    return raw
  }
  try {
    const url = new URL(raw)
    return url.search || url.hash ? null : url.pathname
  } catch {
    return null
  }
}

/**
 * A rule's source in stored form. An absolute URL gives its path (old
 * addresses); a prefix may end in `/*`. Refused: a query string, the
 * home page, backend paths, the storefront's own root pages for an exact
 * rule, and pattern syntax under another kind.
 */
export function parseSource(raw: string, match: RedirectMatch): Checked<string> {
  const text = pathOfUrl(raw.trim())
  if (text === null || text.includes("?") || text.includes("#")) {
    return fail("seo.redirect_source_query")
  }
  const trimmed = match === "prefix" && text.endsWith("/*") ? text.slice(0, -2) : text
  const path = normalizePath(trimmed)
  if (path === null) {
    return fail("seo.redirect_source_invalid")
  }
  if (path === "/") {
    return fail("seo.redirect_source_root")
  }
  if (isBackendPath(path) || (match === "exact" && isReservedPath(path))) {
    return fail("seo.redirect_source_reserved")
  }
  if (match === "pattern") {
    return compilePattern(path) ? ok(path) : fail("seo.redirect_pattern_invalid")
  }
  return looksLikePattern(path) ? fail("seo.redirect_source_wildcard") : ok(path)
}

export interface SplitTarget {
  path: string
  query: string
}

export function splitTarget(target: string): SplitTarget {
  const mark = target.indexOf("?")
  return mark === -1
    ? { path: target, query: "" }
    : { path: target.slice(0, mark), query: target.slice(mark + 1) }
}

/** Placeholders the target uses must come from the source; a pattern target has no literal `:`. */
function checkPlaceholders(path: string, pattern: readonly PatternSegment[] | null): boolean {
  const names = new Set(
    (pattern ?? []).map((segment) =>
      segment.kind === "param" ? segment.name : segment.kind === "rest" ? "*" : ""
    )
  )
  return path
    .split("/")
    .every((part) =>
      part === "*" ? names.has("*") : part.startsWith(":") ? names.has(part.slice(1)) : true
    )
}

// Any segment stands in for a placeholder when a pattern's target is tried against it
const SAMPLE = "x"

/** Whether the rule would match the request it sends: a loop the storefront could never leave. */
function sendsBackToItself(source: string, match: RedirectMatch, targetPath: string): boolean {
  if (match === "exact") {
    return targetPath === source
  }
  if (match === "prefix") {
    return targetPath === source || targetPath.startsWith(`${source}/`)
  }
  const pattern = compilePattern(source)
  const sample = Object.fromEntries(
    (pattern ?? []).flatMap((segment) =>
      segment.kind === "param"
        ? [[segment.name, SAMPLE]]
        : segment.kind === "rest"
          ? [["*", SAMPLE]]
          : []
    )
  )
  return pattern !== null && matchPattern(pattern, fillPath(targetPath, sample)) !== null
}

/**
 * A rule's target in stored form: a path on this site, with an optional
 * query (a search page), never a URL elsewhere (no open redirect). 410
 * rules have none. Refused when the rule would match what it sends.
 */
export function parseTarget(
  raw: string | null | undefined,
  rule: { source: string; match: RedirectMatch; status: RedirectStatus }
): Checked<string | null> {
  if (rule.status === 410) {
    return ok(null)
  }
  const text = (raw ?? "").trim()
  if (text === "") {
    return fail("seo.redirect_target_required")
  }
  if (ABSOLUTE_URL.test(text) || text.includes("#") || text.length > REDIRECT_LIMITS.target) {
    return fail("seo.redirect_target_invalid")
  }
  const split = splitTarget(text)
  const path = normalizePath(split.path)
  const pattern = rule.match === "pattern" ? compilePattern(rule.source) : null
  if (path === null || isBackendPath(path)) {
    return fail("seo.redirect_target_invalid")
  }
  if (!checkPlaceholders(path, pattern)) {
    return fail("seo.redirect_target_placeholder")
  }
  if (sendsBackToItself(rule.source, rule.match, path)) {
    return fail("seo.redirect_self")
  }
  const query = new URLSearchParams(split.query).toString()
  return ok(query ? `${path}?${query}` : path)
}

/** The target's own parameters win; the request's follow by the rule's policy. */
function mergeQuery(
  targetQuery: string,
  request: URLSearchParams,
  policy: QueryPolicy,
  keep: readonly string[]
): string {
  const merged = new URLSearchParams(targetQuery)
  const own = new Set(merged.keys())
  if (policy !== "drop") {
    for (const [key, value] of request) {
      if (!own.has(key) && (policy === "keep" || keep.includes(key))) {
        merged.append(key, value)
      }
    }
  }
  return merged.toString()
}

/**
 * Where the rule sends `request` (it matched): the target with a prefix
 * rule's remainder or a pattern's values filled in, percent-encoded, and
 * the query the policy keeps. Null for a 410 rule.
 */
export function locationOf(
  rule: RedirectRule,
  request: RequestPath,
  params: Readonly<Record<string, string>> = {}
): string | null {
  if (rule.target === null) {
    return null
  }
  const target = splitTarget(rule.target)
  let path = target.path
  if (rule.match === "prefix") {
    const rest = request.path.slice(rule.source.length)
    path = path === "/" ? rest || "/" : `${path}${rest}`
  } else if (rule.match === "pattern") {
    path = fillPath(path, params)
  }
  const query = mergeQuery(target.query, request.query, rule.query_policy, rule.query_keep ?? [])
  return query ? `${encodePath(path)}?${query}` : encodePath(path)
}
