/**
 * Request paths as Express routes them, for deciding which rule applies
 * (rate limits, role tables, the control plane's route allowlist). Pure
 * functions of the request target: each app reads it from its own request
 * object (Medusa: `originalUrl`, as a mounted middleware's `req.path` is
 * stripped of the mount path).
 */

/** The target without its query. */
export function targetPath(target: string): string {
  const end = target.indexOf("?")
  return end === -1 ? target : target.slice(0, end)
}

// `POST http://host/path HTTP/1.1` is a valid request line; Express routes its path
const ABSOLUTE_FORM = /^[a-z][a-z0-9+.-]*:\/\/[^/]*/i

/**
 * The path as Express routes it, the case kept (IDs are case sensitive):
 * without the query, a fragment, the scheme and host of an absolute-form
 * target, or trailing slashes. Percent escapes stay as they are: Express
 * does not decode fixed segments either.
 */
export function routePathKeepingCaseOf(target: string): string {
  const raw = targetPath(target)
  const end = raw.indexOf("#")
  const path = (end === -1 ? raw : raw.slice(0, end)).replace(ABSOLUTE_FORM, "")
  return trimTrailingSlashes(path) || "/"
}

/**
 * The path as Express routes it, lower-cased: Express matches without regard
 * to case or a trailing slash, so judged by the raw path,
 * `/AUTH/customer/emailpass/` would reach the login route and dodge its limit.
 */
export function routePathOf(target: string): string {
  return routePathKeepingCaseOf(target).toLowerCase()
}

// A loop, not `/\/+$/`: that pattern rescans a long run of slashes from every
// start, and a request line of 16 KB of them held the event loop for ~90 ms
function trimTrailingSlashes(path: string): string {
  let end = path.length
  while (end > 0 && path.charCodeAt(end - 1) === 0x2f) {
    end -= 1
  }
  return path.slice(0, end)
}

// A backslash or a fragment in the request line: no client sends one, and
// when `#` is present Express's URL parser turns `\` into `/`, so the route
// Express picks and the path our checks read would differ
const AMBIGUOUS_TARGET = /[\\#]/

/** A path segment as Express hands it to a route parameter: decoded, or as written when malformed. */
export function decodedSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * A `.` or `..` segment, as written or escaped (`%2e%2E`): Express routes
 * it as an ordinary segment (`/admin/gift-cards/../orders` runs the gift
 * card route with the id `..`), a URL parser removes it. No client sends one.
 */
function hasDotSegment(path: string): boolean {
  return path.split("/").some((segment) => {
    const decoded = decodedSegment(segment)
    return decoded === "." || decoded === ".."
  })
}

/** Whether Express and our path checks could read the target differently: refuse it. */
export function isAmbiguousTarget(target: string): boolean {
  return AMBIGUOUS_TARGET.test(target) || hasDotSegment(targetPath(target))
}
