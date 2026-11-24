import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { JSONContent } from "@tiptap/react"
import { sdk } from "@/lib/sdk"

/** A blog's categories and tags (adr/0019 ek 2026-11-03, `/admin/content/terms`). */

export const TERM_KINDS = ["category", "tag"] as const
export type TermKind = (typeof TERM_KINDS)[number]

export const TERM_PAGE_SIZE = 50
/** The server's limit on a post's tags. */
export const MAX_POST_TAGS = 50

/** A term as a post carries it. */
export interface TermView {
  id: string
  name: string
  handle: string
  /** `/blog/kategori/<handle>`, `/blog/etiket/<handle>`: its archive on the storefront. */
  path: string
}

export interface Term extends TermView {
  kind: TermKind
  /** The plain text: the server writes it from the document (adr/0075 Ek 2026-11-24). */
  description: string | null
  /** The text as written; null: plain text only (the editor opens its paragraphs). */
  description_doc: JSONContent | null
  /** The shop's order; then by name. */
  rank: number
  /** Posts filed under it, drafts too. */
  post_count: number
  live_post_count: number
  created_at: string
  updated_at: string
}

export interface TermInput {
  name?: string
  handle?: string
  description?: string | null
  /** The panel sends the document only; the server writes the plain text beside it. */
  description_doc?: JSONContent | null
  rank?: number
}

/** Where a term's archive lives (docs/13 §2.2), whatever the URL style. */
export const TERM_PREFIX: Readonly<Record<TermKind, string>> = {
  category: "/blog/kategori/",
  tag: "/blog/etiket/",
}

const PATH = "/admin/content/terms"
const TERMS_KEY = ["content-terms"] as const

export const termsQuery = ({
  kind,
  q,
  page,
  limit = TERM_PAGE_SIZE,
}: {
  kind: TermKind
  q: string
  page: number
  limit?: number
}) =>
  queryOptions({
    queryKey: [...TERMS_KEY, "list", { kind, q, page, limit }],
    queryFn: () =>
      sdk.client.fetch<{ terms: Term[]; count: number }>(PATH, {
        query: { kind, offset: page * limit, limit, ...(q ? { q } : {}) },
      }),
    placeholderData: keepPreviousData,
  })

/** Every category, for a post's choice (a blog has a dozen or so). */
export const allCategoriesQuery = () =>
  queryOptions({
    queryKey: [...TERMS_KEY, "all-categories"],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ terms: Term[]; count: number }>(PATH, {
          query: { kind: "category", offset: 0, limit: 500 },
        })
      ).terms,
    staleTime: 60_000,
  })

function useTermsChanged() {
  const client = useQueryClient()
  // A term's name and counts show on the posts too
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: TERMS_KEY }),
      client.invalidateQueries({ queryKey: ["content"] }),
    ])
}

export function useCreateTerm() {
  const changed = useTermsChanged()
  return useMutation({
    mutationFn: (body: TermInput & { kind: TermKind; name: string }) =>
      sdk.client.fetch<{ term: Term }>(PATH, { method: "POST", body }),
    onSettled: changed,
  })
}

export function useUpdateTerm(id: string) {
  const changed = useTermsChanged()
  return useMutation({
    mutationFn: (body: TermInput) =>
      sdk.client.fetch<{ term: Term }>(`${PATH}/${encodeURIComponent(id)}`, {
        method: "POST",
        body,
      }),
    onSettled: changed,
  })
}

/** Never refused: a category's posts become uncategorised, a tag leaves its posts. */
export function useDeleteTerm() {
  const changed = useTermsChanged()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<{ id: string; deleted: boolean; unlinked: number }>(
        `${PATH}/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      ),
    onSettled: changed,
  })
}

/** Tags whose name holds `q`, for a post's tag picker. */
export const searchTags = async (q: string): Promise<Term[]> =>
  (
    await sdk.client.fetch<{ terms: Term[]; count: number }>(PATH, {
      query: { kind: "tag", offset: 0, limit: 20, ...(q ? { q } : {}) },
    })
  ).terms
