import type { MedusaContainer } from "@medusajs/framework/types"
import { authorDetail, authorView, authorsByIds } from "../../../workflows/content/author-reads"
import type { AuthorRow } from "../../../workflows/content/author-reads"
import { coverOf, coversOf } from "./covers"

/**
 * Blog authors as the storefront shows them (adr/0060): a post in a list
 * names its author (who, at which page, what they do); a post read whole
 * and an author's own page carry the photo with its size and versions,
 * the bio and the links.
 */

/** The authors of a page of entries, by id, as a list names them. */
export async function listedAuthors(
  container: MedusaContainer,
  ids: readonly (string | null | undefined)[]
): Promise<Map<string, ReturnType<typeof authorView>>> {
  const rows = await authorsByIds(container, ids)
  return new Map([...rows].map(([id, row]) => [id, authorView(row)]))
}

/** An author whole: their photo measured as a cover is. */
export async function storeAuthorDetail(container: MedusaContainer, row: AuthorRow) {
  const photos = await coversOf(container, [row.image_url])
  return { ...authorDetail(row), ...coverOf(photos, row.image_url) }
}

/** The author of one entry, whole; null when it names none (or a deleted one). */
export async function entryAuthor(container: MedusaContainer, authorId: string | null) {
  const row = authorId ? (await authorsByIds(container, [authorId])).get(authorId) : undefined
  return row ? storeAuthorDetail(container, row) : null
}
