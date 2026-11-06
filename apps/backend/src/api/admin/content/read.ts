import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { containsPattern } from "../../../lib/security"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import type { ContentEntryRecord } from "../../../modules/content/service"
import { authorView, authorsByIds } from "../../../workflows/content/author-reads"
import type { AuthorRow } from "../../../workflows/content/author-reads"
import { contentPath } from "../../../workflows/content/paths"
import { termsOfEntries } from "../../../workflows/content/term-reads"
import type { EntryTerms } from "../../../workflows/content/term-reads"
import type { AdminGetContentType } from "./validators"

const LIST_FIELDS = [
  "id",
  "kind",
  "title",
  "handle",
  "status",
  "excerpt",
  "author_name",
  "author_id",
  "image_url",
  "published_at",
  "revised_at",
  "created_at",
  "updated_at",
] as const

type Listed = Pick<ContentEntryRecord, (typeof LIST_FIELDS)[number]>

// A post's category and tags, as ids (what a save sends) and as shown
const filed = ({ category, tags }: EntryTerms) => ({
  category_id: category?.id ?? null,
  tag_ids: tags.map((tag) => tag.id),
  category,
  tags,
})

const NOT_FILED: EntryTerms = { category: null, tags: [] }

// A post's author (adr/0060): its id (what a save sends) and as shown; the old text stays readable
const listed = (entry: Listed, authors: Map<string, AuthorRow>) => {
  const author = entry.author_id ? authors.get(entry.author_id) : undefined
  return {
    ...entryFields(entry),
    author_id: author ? entry.author_id : null,
    author: author ? authorView(author) : null,
  }
}

const entryFields = (entry: Listed) => ({
  id: entry.id,
  kind: entry.kind,
  title: entry.title,
  handle: entry.handle,
  path: contentPath(entry),
  status: entry.status,
  excerpt: entry.excerpt,
  author_name: entry.author_name,
  image_url: entry.image_url,
  published_at: entry.published_at,
  revised_at: entry.revised_at,
  created_at: entry.created_at,
  updated_at: entry.updated_at,
})

/**
 * A page of content entries by title, the most recently changed first;
 * bodies left out, a post's category and tags in.
 */
export async function readContentList(container: MedusaContainer, query: AdminGetContentType) {
  const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
  const filedUnder = query.term_id
    ? (
        await service.listContentEntryTerms(
          { term_id: query.term_id },
          { select: ["entry_id"], take: null }
        )
      ).map((link) => link.entry_id)
    : null
  const page = { offset: query.offset, limit: query.limit }
  if (filedUnder?.length === 0) {
    return { entries: [], count: 0, ...page }
  }
  const [entries, count] = await service.listAndCountContentEntries(
    {
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { title: { $ilike: containsPattern(query.q) } } : {}),
      ...(filedUnder ? { id: filedUnder } : {}),
      ...(query.author_id ? { author_id: query.author_id } : {}),
    },
    {
      select: [...LIST_FIELDS],
      skip: query.offset,
      take: query.limit,
      order: { updated_at: "DESC" },
    }
  )
  const [terms, authors] = await Promise.all([
    termsOfEntries(
      container,
      entries.map((entry) => entry.id)
    ),
    authorsByIds(
      container,
      entries.map((entry) => entry.author_id)
    ),
  ])
  return {
    entries: entries.map((entry) => ({
      ...listed(entry, authors),
      ...filed(terms.get(entry.id) ?? NOT_FILED),
    })),
    count,
    ...page,
  }
}

/** One entry with its document. */
export async function readContentEntry(container: MedusaContainer, id: string) {
  const [entry] = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listContentEntries({ id }, { take: 1 })
  if (!entry) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.unknown")
  }
  const [terms, authors] = await Promise.all([
    termsOfEntries(container, [entry.id]),
    authorsByIds(container, [entry.author_id]),
  ])
  return {
    ...listed(entry, authors),
    ...filed(terms.get(entry.id) ?? NOT_FILED),
    body: entry.body,
    image_alt: entry.image_alt,
  }
}
