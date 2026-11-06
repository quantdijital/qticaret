import type { MedusaContainer } from "@medusajs/framework/types"
import { postAuthorPath } from "../../lib/seo"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import type { ContentAuthorRecord } from "../../modules/content/service"
import { authorLinks } from "./author-rules"

/**
 * Blog authors as the Admin and Store APIs show them (adr/0060): a post's
 * author, an author's posts counted. Counts are one grouped statement.
 */

const service = (container: MedusaContainer) =>
  container.resolve<ContentModuleService>(CONTENT_MODULE)

/** Every field a store page of the author shows. */
export const AUTHOR_FIELDS = [
  "id",
  "name",
  "handle",
  "job_title",
  "bio",
  "image_url",
  "website_url",
  "linkedin_url",
  "instagram_url",
  "x_url",
] as const

export type AuthorRow = Pick<ContentAuthorRecord, (typeof AUTHOR_FIELDS)[number]>

/** An author as a post names them: who, at which page, and what they do. */
export const authorView = (author: Pick<AuthorRow, "id" | "name" | "handle" | "job_title">) => ({
  id: author.id,
  name: author.name,
  handle: author.handle,
  path: postAuthorPath(author.handle),
  job_title: author.job_title,
})

export type AuthorView = ReturnType<typeof authorView>

/** An author with what their own page and a post's author box show. */
export const authorDetail = (author: AuthorRow) => ({
  ...authorView(author),
  bio: author.bio,
  image_url: author.image_url,
  links: authorLinks(author),
})

/** The posts behind each author, counted: live ones only, or every post not deleted. */
export async function authorPostCounts(
  container: MedusaContainer,
  authorIds: readonly string[] | null,
  { live }: { live: boolean }
): Promise<Map<string, number>> {
  const rows = await service(container).countPostsByAuthor(authorIds, { live })
  return new Map(rows.map((row) => [row.author_id, row.count]))
}

/** The authors behind these ids, by id; a deleted one is not there. */
export async function authorsByIds(
  container: MedusaContainer,
  ids: readonly (string | null | undefined)[]
): Promise<Map<string, AuthorRow>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (wanted.length === 0) {
    return new Map()
  }
  const authors = await service(container).listContentAuthors(
    { id: wanted },
    { select: [...AUTHOR_FIELDS], take: null }
  )
  return new Map(authors.map((author) => [author.id, author]))
}

/** An author's id by handle; null when there is no such author. */
export async function authorIdOf(container: MedusaContainer, handle: string) {
  const [author] = await service(container).listContentAuthors(
    { handle },
    { select: ["id"], take: 1 }
  )
  return author?.id ?? null
}

/** An author's live posts, counted, and the newest ones' titles (their page's description). */
export async function livePostsOfAuthor(
  container: MedusaContainer,
  authorId: string,
  take: number
): Promise<{ count: number; titles: string[] }> {
  const [posts, count] = await service(container).listAndCountContentEntries(
    { kind: "post", status: "published", author_id: authorId },
    { select: ["id", "title"], take, order: { published_at: "DESC" } }
  )
  return { count, titles: posts.map((post) => post.title) }
}
