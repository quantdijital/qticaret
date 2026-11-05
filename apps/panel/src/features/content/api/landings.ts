import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { JSONContent } from "@tiptap/react"
import { sdk } from "@/lib/sdk"
import type { ContentStatus } from "./content"

/** Facet landing pages (F3.16, `/admin/landings`): a category and one facet, their own page. */

export const LANDING_PAGE_SIZE = 25

// How much of its own text a page has (docs/14 L-UNIQ-01): under 40% the advisor warns, under 30%
// it shows red and, live, is served noindex until it is more original (adr/0019 Ek 2026-11-05).
// Neither stops it going live: that is the shop's call (the owner, 2026-11-04)
export const ORIGINALITY = { warn: 40, low: 30 } as const

export interface LandingFacet {
  kind: "brand" | "attribute"
  /** The attribute's key, or `marka`. */
  key: string
  /** The option's value, or the brand's id. */
  value: string
}

export interface Landing {
  id: string
  category_id: string
  facet: LandingFacet
  title: string
  handle: string
  /** Null while its category has no path. */
  path: string | null
  status: ContentStatus
  word_count: number
  /** Its own share of text against the other landing pages, 0–100. */
  originality: number
  reviewed_at: string | null
  published_at: string | null
  revised_at: string | null
  updated_at: string
}

export interface LandingDetail extends Landing {
  /** Null once the category is deleted: the page then has no address. */
  category: { name: string } | null
  /** `label` is null once the brand or option is gone. */
  facet: LandingFacet & { label: string | null }
  body: JSONContent
  product_count: number
}

export interface LandingInput {
  title?: string
  handle?: string
  status?: ContentStatus
  body?: JSONContent
  reviewed?: boolean
}

export interface FacetOption {
  value: string
  label: string
}

/** What a landing page may narrow its category by. */
export interface FacetCatalog {
  brand: { key: string; options: FacetOption[] }
  attributes: { key: string; label: string; options: FacetOption[] }[]
}

export const landingsQuery = ({ q, page }: { q: string; page: number }) =>
  queryOptions({
    queryKey: ["landings", "list", { q, page }],
    queryFn: () =>
      sdk.client.fetch<{ landings: Landing[]; count: number }>("/admin/landings", {
        query: { offset: page * LANDING_PAGE_SIZE, limit: LANDING_PAGE_SIZE, ...(q ? { q } : {}) },
      }),
    placeholderData: keepPreviousData,
  })

export const landingQuery = (id: string) =>
  queryOptions({
    queryKey: ["landings", "detail", id],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ landing: LandingDetail }>(
          `/admin/landings/${encodeURIComponent(id)}`
        )
      ).landing,
  })

export const facetCatalogQuery = () =>
  queryOptions({
    queryKey: ["landings", "facets"],
    queryFn: () => sdk.client.fetch<FacetCatalog>("/admin/landings/facets"),
    staleTime: 60_000,
  })

function useLandingsChanged() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: ["landings"] })
}

export function useCreateLanding() {
  const changed = useLandingsChanged()
  return useMutation({
    mutationFn: (
      body: LandingInput & { category_id: string; facet: LandingFacet; title: string }
    ) => sdk.client.fetch<{ landing: LandingDetail }>("/admin/landings", { method: "POST", body }),
    onSettled: changed,
  })
}

export function useUpdateLanding(id: string) {
  const changed = useLandingsChanged()
  return useMutation({
    mutationFn: (body: LandingInput) =>
      sdk.client.fetch<{ landing: LandingDetail }>(`/admin/landings/${encodeURIComponent(id)}`, {
        method: "POST",
        body,
      }),
    onSettled: changed,
  })
}

export function useDeleteLanding() {
  const changed = useLandingsChanged()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/landings/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSettled: changed,
  })
}
