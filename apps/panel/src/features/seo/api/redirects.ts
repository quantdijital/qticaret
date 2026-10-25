import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** Redirect rules, old paths and the 404 log (adr/0017, `/admin/seo/*`). */

export const REDIRECT_PAGE_SIZE = 25
export const REDIRECT_MATCHES = ["exact", "prefix", "pattern"] as const
export type RedirectMatch = (typeof REDIRECT_MATCHES)[number]
export const REDIRECT_STATUSES = [301, 302, 307, 410] as const
export type RedirectStatus = (typeof REDIRECT_STATUSES)[number]
export const QUERY_POLICIES = ["keep", "drop", "keep_list"] as const
export type QueryPolicy = (typeof QUERY_POLICIES)[number]

export interface Redirect {
  id: string
  source: string
  match: RedirectMatch
  target: string | null
  status: RedirectStatus
  query_policy: QueryPolicy
  query_keep: string[]
  origin: "manual" | "import"
  hit_count: number
  last_hit_at: string | null
  created_at: string
  /** A page took the source later: it wins, the rule no longer answers. */
  shadowed: boolean
}

export interface RedirectInput {
  source: string
  match: RedirectMatch
  target: string | null
  status: RedirectStatus
  query_policy: QueryPolicy
  query_keep: string[]
}

export type Answer = "entity" | "redirect" | "gone" | "not_found"

export interface Resolution {
  type: Answer
  path: string | null
  status?: number
  location?: string
  entity_type?: string
  entity_id?: string
}

export interface OldPath {
  path: string
  entity_type: string
  entity_id: string
  name: string | null
  deleted: boolean
  answer: Answer
  location: string | null
  since: string
}

export interface NotFoundEntry {
  id: string
  path: string
  hits: number
  first_seen_at: string
  last_seen_at: string
  last_referer_host: string | null
  answer: Answer
  location: string | null
  suggestions: { path: string; entity_type: string; score: number }[]
}

const page = (number: number, q: string) => ({
  offset: number * REDIRECT_PAGE_SIZE,
  limit: REDIRECT_PAGE_SIZE,
  ...(q ? { q } : {}),
})

export const redirectsQuery = ({
  q,
  page: number,
  match,
}: {
  q: string
  page: number
  match?: RedirectMatch
}) =>
  queryOptions({
    queryKey: ["seo", "redirects", { q, page: number, match }],
    queryFn: () =>
      sdk.client.fetch<{ redirects: Redirect[]; count: number }>("/admin/seo/redirects", {
        query: { ...page(number, q), ...(match ? { match } : {}) },
      }),
    placeholderData: keepPreviousData,
  })

export const oldPathsQuery = ({ q, page: number }: { q: string; page: number }) =>
  queryOptions({
    queryKey: ["seo", "old-paths", { q, page: number }],
    queryFn: () =>
      sdk.client.fetch<{ paths: OldPath[]; count: number }>("/admin/seo/old-paths", {
        query: page(number, q),
      }),
    placeholderData: keepPreviousData,
  })

export const notFoundQuery = ({ q, page: number }: { q: string; page: number }) =>
  queryOptions({
    queryKey: ["seo", "not-found", { q, page: number }],
    queryFn: () =>
      sdk.client.fetch<{ entries: NotFoundEntry[]; count: number }>("/admin/seo/not-found", {
        query: page(number, q),
      }),
    placeholderData: keepPreviousData,
  })

/** How many rules, old paths and open 404s there are, for the tabs. */
export const redirectCountsQuery = () =>
  queryOptions({
    queryKey: ["seo", "counts"],
    queryFn: async () => {
      const count = (path: string) =>
        sdk.client
          .fetch<{ count: number }>(path, { query: { limit: 1 } })
          .then((answer) => answer.count)
      const [rules, old, missing] = await Promise.all([
        count("/admin/seo/redirects"),
        count("/admin/seo/old-paths"),
        count("/admin/seo/not-found"),
      ])
      return { rules, old, missing }
    },
  })

export const resolveQuery = (path: string) =>
  queryOptions({
    queryKey: ["seo", "resolve", path],
    queryFn: () =>
      sdk.client.fetch<{ resolution: Resolution }>("/admin/seo/resolve", { query: { path } }),
    enabled: path !== "",
    staleTime: 0,
  })

/** Every change to rules or paths can move what every list and answer says. */
function useSeoInvalidation() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: ["seo"] })
}

export function useSaveRedirect() {
  const invalidate = useSeoInvalidation()
  return useMutation({
    mutationFn: ({ id, rule }: { id?: string; rule: RedirectInput }) =>
      sdk.client.fetch<{ redirect: Redirect }>(
        id ? `/admin/seo/redirects/${id}` : "/admin/seo/redirects",
        { method: "POST", body: rule }
      ),
    onSettled: invalidate,
  })
}

export function useDeleteRedirect() {
  const invalidate = useSeoInvalidation()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/seo/redirects/${id}`, { method: "DELETE" }),
    onSettled: invalidate,
  })
}

export function useReleasePath() {
  const invalidate = useSeoInvalidation()
  return useMutation({
    mutationFn: (path: string) =>
      sdk.client.fetch("/admin/seo/old-paths/release", { method: "POST", body: { path } }),
    onSettled: invalidate,
  })
}

export function useDismissNotFound() {
  const invalidate = useSeoInvalidation()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/seo/not-found/${id}`, { method: "DELETE" }),
    onSettled: invalidate,
  })
}

export interface ImportReport {
  dry_run: boolean
  applied: boolean
  rows: number
  created: number
  updated: number
  problems: { line: number; code: string; message: string; field: string | null }[]
}

export function useImportRedirects() {
  const invalidate = useSeoInvalidation()
  return useMutation({
    mutationFn: ({ csv, dryRun }: { csv: string; dryRun: boolean }) =>
      sdk.client.fetch<ImportReport>("/admin/seo/redirect-file", {
        method: "POST",
        body: { csv, dry_run: dryRun },
      }),
    onSettled: invalidate,
  })
}

/** Same origin, the session cookie: the browser saves the file the backend sends. */
export const REDIRECT_EXPORT_URL = "/admin/seo/redirect-file"
