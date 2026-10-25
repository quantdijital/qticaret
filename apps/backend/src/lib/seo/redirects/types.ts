/**
 * Redirect rules (adr/0017, docs/13 §4): the kinds of match, the answers
 * and the query policies a rule may have.
 */

export const REDIRECT_MATCHES = ["exact", "prefix", "pattern"] as const
export type RedirectMatch = (typeof REDIRECT_MATCHES)[number]

export const REDIRECT_STATUSES = [301, 302, 307, 410] as const
export type RedirectStatus = (typeof REDIRECT_STATUSES)[number]

/** What happens to the request's query string: kept, dropped, or only the listed names kept. */
export const QUERY_POLICIES = ["keep", "drop", "keep_list"] as const
export type QueryPolicy = (typeof QUERY_POLICIES)[number]

export const REDIRECT_LIMITS = {
  path: 512,
  target: 1024,
  segments: 32,
  keepList: 20,
} as const

export type Checked<T> = { ok: true; value: T } | { ok: false; key: string }

export const ok = <T>(value: T): Checked<T> => ({ ok: true, value })
export const fail = <T>(key: string): Checked<T> => ({ ok: false, key })

export interface RedirectRule {
  id: string
  source: string
  match: RedirectMatch
  target: string | null
  status: RedirectStatus
  query_policy: QueryPolicy
  query_keep: readonly string[] | null
}
