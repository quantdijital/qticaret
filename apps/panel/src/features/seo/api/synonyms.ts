import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
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

/** A new group, or a group's terms replaced. */
export function useSaveSynonym() {
  const invalidate = useSynonymsInvalidation()
  return useMutation({
    mutationFn: ({ id, terms }: { id?: string | undefined; terms: string[] }) =>
      sdk.client.fetch<{ synonym: SynonymGroup }>(
        id ? `/admin/search/synonyms/${encodeURIComponent(id)}` : "/admin/search/synonyms",
        { method: "POST", body: { terms } }
      ),
    onSettled: invalidate,
  })
}

export function useDeleteSynonym() {
  const invalidate = useSynonymsInvalidation()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<{ id: string; object: "search_synonym"; deleted: true }>(
        `/admin/search/synonyms/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      ),
    onSettled: invalidate,
  })
}
