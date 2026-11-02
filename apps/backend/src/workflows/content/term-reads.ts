import type { MedusaContainer } from "@medusajs/framework/types"
import { chunksOf } from "../../lib/catalog"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import type { ContentTermKind, ContentTermRecord } from "../../modules/content/service"
import { termPath } from "./term-rules"

/**
 * Blog categories and tags as the Admin and Store APIs show them (adr/0019
 * ek 2026-11-03): a post's terms, a term's posts and how many of them are
 * live. A blog holds hundreds of posts and terms, not millions: the links
 * are read whole and the posts by id.
 */

export interface TermView {
  id: string
  name: string
  handle: string
  path: string
}

export interface EntryTerms {
  category: TermView | null
  tags: TermView[]
}

const service = (container: MedusaContainer) =>
  container.resolve<ContentModuleService>(CONTENT_MODULE)

export const termView = (term: Pick<ContentTermRecord, "id" | "kind" | "name" | "handle">) => ({
  id: term.id,
  name: term.name,
  handle: term.handle,
  path: termPath(term),
})

// The shop's order, then the name as a Turkish reader sorts it
export const byRank = (
  a: Pick<ContentTermRecord, "rank" | "name">,
  b: Pick<ContentTermRecord, "rank" | "name">
): number => a.rank - b.rank || a.name.localeCompare(b.name, "tr")

/** Each entry's category and tags, the tags in the shop's order. */
export async function termsOfEntries(
  container: MedusaContainer,
  entryIds: readonly string[]
): Promise<Map<string, EntryTerms>> {
  const answer = new Map<string, EntryTerms>(
    entryIds.map((id) => [id, { category: null, tags: [] }])
  )
  if (entryIds.length === 0) {
    return answer
  }
  const links = await service(container).listContentEntryTerms(
    { entry_id: [...entryIds] },
    { select: ["entry_id", "term_id"], take: null }
  )
  const termIds = [...new Set(links.map((link) => link.term_id))]
  const terms = termIds.length
    ? await service(container).listContentTerms(
        { id: termIds },
        { select: ["id", "kind", "name", "handle", "rank"], take: null }
      )
    : []
  const byId = new Map(terms.map((term) => [term.id, term]))
  const tagsOf = new Map<string, typeof terms>()
  for (const link of links) {
    const term = byId.get(link.term_id)
    const entry = answer.get(link.entry_id)
    if (!term || !entry) {
      continue
    }
    if (term.kind === "category") {
      entry.category = termView(term)
    } else {
      tagsOf.set(link.entry_id, [...(tagsOf.get(link.entry_id) ?? []), term])
    }
  }
  for (const [entryId, tags] of tagsOf) {
    const entry = answer.get(entryId)
    if (entry) {
      entry.tags = [...tags].sort(byRank).map(termView)
    }
  }
  return answer
}

/** The posts behind each term, counted: live ones only, or every post not deleted. */
export async function postCounts(
  container: MedusaContainer,
  termIds: readonly string[] | null,
  { live }: { live: boolean }
): Promise<Map<string, number>> {
  const links = await service(container).listContentEntryTerms(
    termIds ? { term_id: [...termIds] } : {},
    { select: ["entry_id", "term_id"], take: null }
  )
  const entryIds = [...new Set(links.map((link) => link.entry_id))]
  const posts = new Set<string>()
  for (const chunk of chunksOf(entryIds)) {
    const rows = await service(container).listContentEntries(
      { id: chunk, kind: "post", ...(live ? { status: "published" as const } : {}) },
      { select: ["id"], take: null }
    )
    rows.forEach((row) => posts.add(row.id))
  }
  const counts = new Map<string, number>()
  for (const link of links) {
    if (posts.has(link.entry_id)) {
      counts.set(link.term_id, (counts.get(link.term_id) ?? 0) + 1)
    }
  }
  return counts
}

/** The entries filed under a term named by kind and handle; null when there is no such term. */
export async function entryIdsOfTerm(
  container: MedusaContainer,
  kind: ContentTermKind,
  handle: string
): Promise<string[] | null> {
  const [term] = await service(container).listContentTerms(
    { kind, handle },
    { select: ["id"], take: 1 }
  )
  if (!term) {
    return null
  }
  const links = await service(container).listContentEntryTerms(
    { term_id: term.id },
    { select: ["entry_id"], take: null }
  )
  return links.map((link) => link.entry_id)
}

/** A term's live posts, counted, and the newest ones' titles (an archive's description). */
export async function livePostsOfTerm(
  container: MedusaContainer,
  termId: string,
  take: number
): Promise<{ count: number; titles: string[] }> {
  const links = await service(container).listContentEntryTerms(
    { term_id: termId },
    { select: ["entry_id"], take: null }
  )
  if (links.length === 0) {
    return { count: 0, titles: [] }
  }
  const [posts, count] = await service(container).listAndCountContentEntries(
    { id: links.map((link) => link.entry_id), kind: "post", status: "published" },
    { select: ["title"], take, order: { published_at: "DESC" } }
  )
  return { count, titles: posts.map((post) => post.title) }
}
