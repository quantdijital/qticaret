import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { JSONContent } from "@tiptap/react"
import { sdk } from "@/lib/sdk"

/** Content pages and blog posts (F3.16, `/admin/content`). */

export const CONTENT_KINDS = ["page", "post"] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]
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
  author_name: string | null
  image_url: string | null
  published_at: string | null
  revised_at: string | null
  created_at: string
  updated_at: string
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
  author_name?: string | null
  image_url?: string | null
  image_alt?: string | null
}

export const contentListQuery = ({
  kind,
  q,
  page,
}: {
  kind: ContentKind
  q: string
  page: number
}) =>
  queryOptions({
    queryKey: ["content", "list", { kind, q, page }],
    queryFn: () =>
      sdk.client.fetch<{ entries: ContentEntry[]; count: number }>("/admin/content", {
        query: {
          kind,
          offset: page * CONTENT_PAGE_SIZE,
          limit: CONTENT_PAGE_SIZE,
          ...(q ? { q } : {}),
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
