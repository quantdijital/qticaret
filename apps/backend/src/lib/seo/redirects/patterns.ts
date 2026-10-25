import { REDIRECT_LIMITS } from "./types"
import type { RedirectRule } from "./types"

/**
 * The safe pattern language (adr/0017): `:name` takes one segment and a
 * final `*` the rest. Matching walks the segments once, so no rule can make
 * the public resolve endpoint slow, whatever it says.
 */

const PARAM_NAME = /^[a-z][a-z0-9_]{0,31}$/

export type PatternSegment =
  { kind: "literal"; value: string } | { kind: "param"; name: string } | { kind: "rest" }

/**
 * `/eski/:slug/*` as segments. Null unless every placeholder is a whole
 * segment with a unique name, `*` comes last, and one segment at least is
 * literal (a pattern of placeholders only would catch every path).
 */
export function compilePattern(source: string): PatternSegment[] | null {
  const parts = source.split("/").slice(1)
  if (parts.length > REDIRECT_LIMITS.segments) {
    return null
  }
  const names = new Set<string>()
  const segments: PatternSegment[] = []
  for (const [index, part] of parts.entries()) {
    if (part === "*") {
      if (index !== parts.length - 1) {
        return null
      }
      segments.push({ kind: "rest" })
    } else if (part.startsWith(":")) {
      const name = part.slice(1)
      if (!PARAM_NAME.test(name) || names.has(name)) {
        return null
      }
      names.add(name)
      segments.push({ kind: "param", name })
    } else if (/[:*]/.test(part) || part === "") {
      return null
    } else {
      segments.push({ kind: "literal", value: part })
    }
  }
  return segments.some((segment) => segment.kind === "literal") ? segments : null
}

/** The placeholders' values when `path` fits the pattern, `*` holding the rest; one pass. */
export function matchPattern(
  pattern: readonly PatternSegment[],
  path: string
): Record<string, string> | null {
  const parts = path === "/" ? [] : path.split("/").slice(1)
  const params: Record<string, string> = {}
  for (const [index, segment] of pattern.entries()) {
    if (segment.kind === "rest") {
      const rest = parts.slice(index)
      if (rest.length === 0) {
        return null
      }
      params["*"] = rest.join("/")
      return params
    }
    const part = parts[index]
    if (part === undefined) {
      return null
    }
    if (segment.kind === "literal") {
      if (part !== segment.value) {
        return null
      }
    } else {
      params[segment.name] = part
    }
  }
  return parts.length === pattern.length ? params : null
}

/** The target with the placeholders' values in their segments. */
export function fillPath(path: string, params: Readonly<Record<string, string>>): string {
  return path
    .split("/")
    .map((part) =>
      part === "*"
        ? (params["*"] ?? "")
        : part.startsWith(":")
          ? (params[part.slice(1)] ?? "")
          : part
    )
    .join("/")
}

export interface CompiledPatternRule extends RedirectRule {
  segments: readonly PatternSegment[]
}

const timeOf = (value: Date | string | null | undefined): number =>
  value ? new Date(value).getTime() : 0

const literalCount = (segments: readonly PatternSegment[]): number =>
  segments.filter((segment) => segment.kind === "literal").length

/**
 * Pattern rules in the order they are tried: more literal segments first,
 * then more segments, then the older rule; so `/eski/kategori/:slug` wins
 * over `/eski/:a/:b` whatever order they were written in.
 */
export function orderPatterns(
  rules: readonly (RedirectRule & { created_at?: Date | string | null })[]
): CompiledPatternRule[] {
  const compiled = rules.flatMap((rule) => {
    const segments = compilePattern(rule.source)
    return segments ? [{ rule, segments }] : []
  })
  compiled.sort(
    (a, b) =>
      literalCount(b.segments) - literalCount(a.segments) ||
      b.segments.length - a.segments.length ||
      timeOf(a.rule.created_at) - timeOf(b.rule.created_at) ||
      a.rule.id.localeCompare(b.rule.id)
  )
  return compiled.map(({ rule, segments }) => ({ ...rule, segments }))
}

export interface RuleMatch {
  rule: RedirectRule
  params: Record<string, string>
}

/**
 * The rule that answers `path` (adr/0017): the exact rule, else the
 * longest prefix, else the first pattern in `orderPatterns` order.
 */
export function pickRule(
  path: string,
  candidates: readonly RedirectRule[],
  patterns: readonly CompiledPatternRule[]
): RuleMatch | null {
  const exact = candidates.find((rule) => rule.match === "exact" && rule.source === path)
  if (exact) {
    return { rule: exact, params: {} }
  }
  const prefix = candidates
    .filter(
      (rule) =>
        rule.match === "prefix" && (path === rule.source || path.startsWith(`${rule.source}/`))
    )
    .sort((a, b) => b.source.length - a.source.length)[0]
  if (prefix) {
    return { rule: prefix, params: {} }
  }
  for (const rule of patterns) {
    const params = matchPattern(rule.segments, path)
    if (params) {
      return { rule, params }
    }
  }
  return null
}
