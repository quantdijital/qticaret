import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A blog's authors (`/admin/content/authors`): each with a page of their own on the storefront. */

export const AUTHOR_PAGE_SIZE = 50
/** Where an author's page lives (`/blog/yazar/<handle>`), whatever the URL style. */
export const AUTHOR_PREFIX = "/blog/yazar/"
/** The server's bounds. */
export const AUTHOR_LIMITS = { name: 120, jobTitle: 120, bio: 2000 } as const

/** An author as a post carries it. */
export interface AuthorView {
  id: string
  name: string
  handle: string
  /** `/blog/yazar/<handle>`: the author's page on the storefront. */
  path: string
}

export const AUTHOR_LINKS = ["website_url", "linkedin_url", "instagram_url", "x_url"] as const
export type AuthorLink = (typeof AUTHOR_LINKS)[number]

export interface Author extends AuthorView, Record<AuthorLink, string | null> {
  job_title: string | null
  /** Plain text; a blank line starts a paragraph. */
  bio: string | null
  /** A media library upload's address. */
  image_url: string | null
  /** The staff account this author is, if any. */
  user_id: string | null
  user: { id: string; email: string; name: string | null } | null
  /** Posts by them, drafts too. */
  post_count: number
  live_post_count: number
  created_at: string
  updated_at: string
}

export type AuthorInput = Partial<Record<AuthorLink, string | null>> & {
  name?: string
  handle?: string
  job_title?: string | null
  bio?: string | null
  image_url?: string | null
  user_id?: string | null
}

const PATH = "/admin/content/authors"
const AUTHORS_KEY = ["content-authors"] as const

export const authorsQuery = ({
  q,
  page,
  limit = AUTHOR_PAGE_SIZE,
}: {
  q: string
  page: number
  limit?: number
}) =>
  queryOptions({
    queryKey: [...AUTHORS_KEY, "list", { q, page, limit }],
    queryFn: () =>
      sdk.client.fetch<{ authors: Author[]; count: number }>(PATH, {
        query: { offset: page * limit, limit, ...(q ? { q } : {}) },
      }),
    placeholderData: keepPreviousData,
  })

/** Authors whose name holds `q`, for a post's author select. */
export const searchAuthors = async (q: string): Promise<Author[]> =>
  (
    await sdk.client.fetch<{ authors: Author[]; count: number }>(PATH, {
      query: { offset: 0, limit: 20, ...(q ? { q } : {}) },
    })
  ).authors

export const authorQuery = (id: string) =>
  queryOptions({
    queryKey: [...AUTHORS_KEY, "detail", id],
    queryFn: async () =>
      (await sdk.client.fetch<{ author: Author }>(`${PATH}/${encodeURIComponent(id)}`)).author,
  })

function useAuthorsChanged() {
  const client = useQueryClient()
  // An author's name shows on their posts too
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: AUTHORS_KEY }),
      client.invalidateQueries({ queryKey: ["content"] }),
    ])
}

export function useCreateAuthor() {
  const changed = useAuthorsChanged()
  return useMutation({
    mutationFn: (body: AuthorInput & { name: string }) =>
      sdk.client.fetch<{ author: Author }>(PATH, { method: "POST", body }),
    onSettled: changed,
  })
}

export function useUpdateAuthor(id: string) {
  const changed = useAuthorsChanged()
  return useMutation({
    mutationFn: (body: AuthorInput) =>
      sdk.client.fetch<{ author: Author }>(`${PATH}/${encodeURIComponent(id)}`, {
        method: "POST",
        body,
      }),
    onSettled: changed,
  })
}

/** Never refused: the author's posts lose their author. */
export function useDeleteAuthor() {
  const changed = useAuthorsChanged()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<{ id: string; deleted: boolean; unlinked: number }>(
        `${PATH}/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      ),
    onSettled: changed,
  })
}
