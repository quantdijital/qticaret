import { isCleanText } from "../../security"
import { REDIRECT_LIMITS } from "./types"

/**
 * Paths as rules and the URL registry store them (adr/0017), and the
 * storefront request a resolve call carries.
 */

// Paths the backend serves, should a proxy put them on the storefront's host
// (F16): no rule may take a request there or send one there
const BACKEND_ROOTS = new Set(["admin", "app", "api", "auth", "health", "hooks", "static", "store"])

const firstSegment = (path: string): string => path.split("/")[1] ?? ""

/** Whether a path (or a location) leads to the backend rather than a storefront page. */
export const isBackendPath = (path: string): boolean => BACKEND_ROOTS.has(firstSegment(path))

// Invisible and direction-changing characters (zero-width, bidi overrides):
// no page has them, and in the panel they would make one address look like another
const FORMAT_CHARACTER = /\p{Cf}/u

// What a decoded segment may not hold: separators of its own, query or
// fragment marks, control characters, lone surrogates (two of which would
// reach the database as the same replacement character)
const isCleanSegment = (segment: string): boolean =>
  segment !== "." &&
  segment !== ".." &&
  !/[/\\?#]/.test(segment) &&
  isCleanText(segment) &&
  !FORMAT_CHARACTER.test(segment)

/**
 * A path in the form rules and the URL registry store: each segment
 * percent-decoded, NFC, lower case; empty segments and the trailing slash
 * dropped. Null for what no page can have: dot segments, an encoded slash,
 * backslash, `?` or `#`, control, format or broken characters, over-long
 * paths.
 */
export function normalizePath(raw: string): string | null {
  if (!raw.startsWith("/") || raw.length > REDIRECT_LIMITS.path * 3) {
    return null
  }
  const segments: string[] = []
  for (const part of raw.split("/")) {
    if (part === "") {
      continue
    }
    let segment: string
    try {
      segment = decodeURIComponent(part)
    } catch {
      return null
    }
    if (!isCleanSegment(segment)) {
      return null
    }
    segments.push(segment.normalize("NFC").toLowerCase())
  }
  const path = `/${segments.join("/")}`
  return path.length <= REDIRECT_LIMITS.path ? path : null
}

export interface RequestPath {
  path: string
  query: URLSearchParams
}

/** The storefront's request (`/eski-urun?utm_source=x`): its normalised path and query. */
export function parseRequestPath(raw: string): RequestPath | null {
  const hash = raw.indexOf("#")
  const withoutHash = hash === -1 ? raw : raw.slice(0, hash)
  const mark = withoutHash.indexOf("?")
  const path = normalizePath(mark === -1 ? withoutHash : withoutHash.slice(0, mark))
  if (path === null) {
    return null
  }
  return { path, query: new URLSearchParams(mark === -1 ? "" : withoutHash.slice(mark + 1)) }
}

/** Every ancestor of `path`, nearest first: the sources a prefix rule may have. */
export function prefixesOf(path: string): string[] {
  const segments = path.split("/").slice(1)
  const prefixes: string[] = []
  for (let length = segments.length; length >= 1; length -= 1) {
    prefixes.push(`/${segments.slice(0, length).join("/")}`)
  }
  return prefixes
}

export const encodePath = (path: string): string =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
