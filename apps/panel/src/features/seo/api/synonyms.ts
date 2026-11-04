import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { responseFailure } from "@/lib/errors"
import { sdk } from "@/lib/sdk"

/** Site search's synonym groups (adr/0056, `/admin/search/synonyms`). */

export interface SynonymGroup {
  id: string
  terms: string[]
  created_at: string
  updated_at: string
}

export interface SynonymList {
  synonyms: SynonymGroup[]
  count: number
}

export const SYNONYM_PAGE_SIZE = 25
/** A shop keeps at most this many groups; the server refuses the next one. */
export const MAX_SYNONYM_GROUPS = 1000
// The server reads at most this much of a search
const MAX_QUERY = 60

const SYNONYMS_KEY = ["seo", "synonyms"] as const

/** The groups, newest first; with `q`, those with a term holding it (`tisort` finds `tişört`). */
export const synonymsQuery = ({ q, page }: { q: string; page: number }) =>
  queryOptions({
    queryKey: [...SYNONYMS_KEY, "list", { q, page }],
    queryFn: () =>
      sdk.client.fetch<SynonymList>("/admin/search/synonyms", {
        query: {
          offset: page * SYNONYM_PAGE_SIZE,
          limit: SYNONYM_PAGE_SIZE,
          ...(q.trim() ? { q: q.trim().slice(0, MAX_QUERY) } : {}),
        },
      }),
    placeholderData: keepPreviousData,
  })

/** The newest few groups and how many there are, for the SEO overview. */
export const latestSynonymsQuery = (limit: number) =>
  queryOptions({
    queryKey: [...SYNONYMS_KEY, "latest", limit],
    queryFn: () => sdk.client.fetch<SynonymList>("/admin/search/synonyms", { query: { limit } }),
  })

function useSynonymsInvalidation() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: SYNONYMS_KEY })
}

/**
 * A write, not through the SDK: its error keeps only the server's
 * sentence, and the screen says a refusal (two to ten terms, 60
 * characters…) in the panel's own words by its key (`code`, adr/0021).
 */
async function write<T>(path: string, method: "POST" | "DELETE", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!response.ok) {
    throw await responseFailure(response)
  }
  return (await response.json()) as T
}

/** A new group, or a group's terms replaced. */
export function useSaveSynonym() {
  const invalidate = useSynonymsInvalidation()
  return useMutation({
    mutationFn: ({ id, terms }: { id?: string | undefined; terms: string[] }) =>
      write<{ synonym: SynonymGroup }>(
        id ? `/admin/search/synonyms/${encodeURIComponent(id)}` : "/admin/search/synonyms",
        "POST",
        { terms }
      ),
    onSettled: invalidate,
  })
}

export function useDeleteSynonym() {
  const invalidate = useSynonymsInvalidation()
  return useMutation({
    mutationFn: (id: string) =>
      write<{ id: string; object: "search_synonym"; deleted: true }>(
        `/admin/search/synonyms/${encodeURIComponent(id)}`,
        "DELETE"
      ),
    onSettled: invalidate,
  })
}
