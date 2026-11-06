import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { JSONContent } from "@tiptap/react"
import { sdk } from "@/lib/sdk"
import type { AuthorView } from "./authors"
import type { TermView } from "./terms"

/** Content pages and blog posts (F3.16, `/admin/content`). */

export const CONTENT_KINDS = ["page", "post"] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

/**
 * The Content screen's tabs: pages, posts, the blog's categories, tags and
 * authors (adr/0019 ek 2026-11-03) and the facet landing pages (F3.16).
 */
export const CONTENT_TABS = ["page", "post", "category", "tag", "author", "landing"] as const
export type ContentTab = (typeof CONTENT_TABS)[number]
export type ContentStatus = "draft" | "published"

export const CONTENT_PAGE_SIZE = 25

export interface ContentEntry {
  id: string
  kind: ContentKind
  title: string
  handle: string
  /** `/hakkimizda`, `/blog/kupa-secimi`: where the storefront shows it. */
  path: string
  status: ContentStatus
  excerpt: string | null
  /** The old free-text author, read only: shown until an author is chosen. */
  author_name: string | null
  /** A post's author from the blog's authors; null: none chosen. */
  author_id: string | null
  author: AuthorView | null
  image_url: string | null
  published_at: string | null
  revised_at: string | null
  created_at: string
  updated_at: string
  /** A post's category and tags; a page has none. */
  category_id: string | null
  tag_ids: string[]
  category: TermView | null
  tags: TermView[]
}

export interface ContentDetail extends ContentEntry {
  /** The editor's document (adr/0019); the server keeps it to its allowlist. */
  body: JSONContent
  image_alt: string | null
}

export interface ContentInput {
  title?: string
  handle?: string
  status?: ContentStatus
  body?: JSONContent
  excerpt?: string | null
  /** A post's author; null clears it. */
  author_id?: string | null
  image_url?: string | null
  image_alt?: string | null
  /** A post's category; null clears it. */
  category_id?: string | null
  /** A post's tags, all of them; [] clears them. */
  tag_ids?: string[]
}

export const contentListQuery = ({
  kind,
  q,
  page,
  termId,
}: {
  kind: ContentKind
  q: string
  page: number
  /** Only the posts filed under this category or tag. */
  termId?: string
}) =>
  queryOptions({
    queryKey: ["content", "list", { kind, q, page, termId }],
    queryFn: () =>
      sdk.client.fetch<{ entries: ContentEntry[]; count: number }>("/admin/content", {
        query: {
          kind,
          offset: page * CONTENT_PAGE_SIZE,
          limit: CONTENT_PAGE_SIZE,
          ...(q ? { q } : {}),
          ...(termId ? { term_id: termId } : {}),
        },
      }),
    placeholderData: keepPreviousData,
  })

export const contentQuery = (id: string) =>
  queryOptions({
    queryKey: ["content", "detail", id],
    queryFn: async () =>
      (await sdk.client.fetch<{ entry: ContentDetail }>(`/admin/content/${encodeURIComponent(id)}`))
        .entry,
  })

function useContentChanged() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: ["content"] })
}

export function useCreateContent() {
  const changed = useContentChanged()
  return useMutation({
    mutationFn: (body: ContentInput & { kind: ContentKind; title: string }) =>
      sdk.client.fetch<{ entry: ContentDetail }>("/admin/content", { method: "POST", body }),
    onSettled: changed,
  })
}

export function useUpdateContent(id: string) {
  const changed = useContentChanged()
  return useMutation({
    mutationFn: (body: ContentInput) =>
      sdk.client.fetch<{ entry: ContentDetail }>(`/admin/content/${encodeURIComponent(id)}`, {
        method: "POST",
        body,
      }),
    onSettled: changed,
  })
}

export function useDeleteContent() {
  const changed = useContentChanged()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/content/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSettled: changed,
  })
}

/** A link that shows the entry, draft or not, on the storefront for a day (F18). */
export function useContentPreview(id: string) {
  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ url: string; path: string; expires_at: string }>(
        `/admin/content/${encodeURIComponent(id)}/preview`,
        { method: "POST" }
      ),
  })
}
