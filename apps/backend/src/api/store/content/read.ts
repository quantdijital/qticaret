import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { docStats, renderDoc, summaryOf } from "../../../lib/content"
import type { ContentDoc } from "../../../lib/content"
import { DESCRIPTION_EXCERPT } from "../../../lib/seo/resolve"
import { fillShopDoc, fillShopText } from "../../../lib/shop/tokens"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import type { ContentEntryRecord } from "../../../modules/content/service"
import { contentPath } from "../../../workflows/content/paths"
import { entryIdsOfTerm, termsOfEntries } from "../../../workflows/content/term-reads"
import type { EntryTerms } from "../../../workflows/content/term-reads"
import { shopInfoValues } from "../../../workflows/shop/info-values"
import { cardTargets } from "./cards"
import type { StoreGetContentType } from "./validators"

// A reader's pace, for the "n min" a theme may show
const WORDS_PER_MINUTE = 200

// What a list shows: never the document itself (its summary and word count are kept at save)
const LIST_FIELDS = [
  "id",
  "kind",
  "title",
  "handle",
  "excerpt",
  "body_summary",
  "word_count",
  "image_url",
  "image_alt",
  "author_name",
  "published_at",
  "revised_at",
] as const

type Listed = Pick<ContentEntryRecord, (typeof LIST_FIELDS)[number]>

const service = (container: MedusaContainer) =>
  container.resolve<ContentModuleService>(CONTENT_MODULE)

/** What the storefront shows of an entry in a list; its own summary, else its opening. */
const summary = (entry: Listed) => ({
  id: entry.id,
  kind: entry.kind,
  title: entry.title,
  handle: entry.handle,
  path: contentPath(entry),
  excerpt: entry.excerpt ?? summaryOf(entry.body_summary, DESCRIPTION_EXCERPT),
  image_url: entry.image_url,
  image_alt: entry.image_alt,
  author_name: entry.author_name,
  published_at: entry.published_at,
  revised_at: entry.revised_at,
  reading_minutes: Math.max(1, Math.round(entry.word_count / WORDS_PER_MINUTE)),
})

const NOT_FILED: EntryTerms = { category: null, tags: [] }

/**
 * The entries filed under the category and tag the query names (both, when
 * both); null when it names neither, none for a term there is not.
 */
async function filedUnder(
  container: MedusaContainer,
  query: StoreGetContentType
): Promise<string[] | null> {
  const wanted = [
    ...(query.category ? [entryIdsOfTerm(container, "category", query.category)] : []),
    ...(query.tag ? [entryIdsOfTerm(container, "tag", query.tag)] : []),
  ]
  if (wanted.length === 0) {
    return null
  }
  const [first = [], ...rest] = (await Promise.all(wanted)).map((ids) => ids ?? [])
  return rest.reduce((kept, ids) => kept.filter((id) => ids.includes(id)), first)
}

/**
 * Live entries, the newest first, a post with its category and tags; a
 * category or tag narrows them to its posts. Page SEO comes from
 * `/store/seo/resolve`.
 */
export async function storeContentList(container: MedusaContainer, query: StoreGetContentType) {
  const page = { offset: query.offset, limit: query.limit }
  const filed = await filedUnder(container, query)
  if (filed?.length === 0) {
    return { entries: [], count: 0, ...page }
  }
  const [entries, count] = await service(container).listAndCountContentEntries(
    {
      status: "published",
      ...(filed ? { kind: "post" as const, id: filed } : query.kind ? { kind: query.kind } : {}),
    },
    {
      select: [...LIST_FIELDS],
      skip: query.offset,
      take: query.limit,
      order: { published_at: "DESC" },
    }
  )
  const [values, terms] = await Promise.all([
    shopInfoValues(container),
    termsOfEntries(
      container,
      entries.map((entry) => entry.id)
    ),
  ])
  return {
    entries: entries.map((entry) => {
      const listed = summary(entry)
      return {
        ...listed,
        excerpt: fillShopText(listed.excerpt, values),
        ...(terms.get(entry.id) ?? NOT_FILED),
      }
    }),
    count,
    ...page,
  }
}

/**
 * One live entry with its HTML (adr/0019): rendered here from the checked
 * document, its cards drawn from live products and categories at their
 * current paths. A draft answers 404 as if it did not exist.
 */
export async function storeContentEntry(
  container: MedusaContainer,
  id: string,
  // A draft's signed preview (`previewEntryOf`) opens it whatever its status
  { draft = false }: { draft?: boolean } = {}
) {
  const [entry] = await service(container).listContentEntries(
    draft ? { id } : { id, status: "published" },
    { take: 1 }
  )
  if (!entry) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.unknown")
  }
  // The shop's details stand where the text names them (adr/0048)
  const values = await shopInfoValues(container)
  const body = fillShopDoc(entry.body as unknown as ContentDoc, values)
  const listed = summary(entry)
  const terms = await termsOfEntries(container, [entry.id])
  return {
    ...listed,
    excerpt: fillShopText(listed.excerpt, values),
    // A post's category and tags, at their archives' paths (adr/0019 ek 2026-11-03)
    ...(terms.get(entry.id) ?? NOT_FILED),
    html: renderDoc(body, await cardTargets(container, body)),
    // For a table of contents
    headings: docStats(body).headings,
  }
}
