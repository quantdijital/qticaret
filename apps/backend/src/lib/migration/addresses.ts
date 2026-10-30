import { parseRequestPath } from "../seo/redirects"

export interface OldAddress {
  address: string
  path: string
  query: string | null
}

/**
 * An old address as rules store it: a path or a full URL, its path
 * normalised, its query (sorted, so two orders are one address) kept
 * apart. Null for what no page can have.
 */
export function oldAddressOf(raw: string): OldAddress | null {
  let pathAndQuery = raw.trim()
  if (/^https?:\/\//i.test(pathAndQuery)) {
    try {
      const url = new URL(pathAndQuery)
      pathAndQuery = `${url.pathname}${url.search}`
    } catch {
      return null
    }
  }
  const request = parseRequestPath(pathAndQuery)
  if (!request) {
    return null
  }
  request.query.sort()
  const query = request.query.toString() || null
  return { address: query ? `${request.path}?${query}` : request.path, path: request.path, query }
}
