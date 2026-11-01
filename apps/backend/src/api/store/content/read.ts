import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { docStats, renderDoc, summaryOf } from "../../../lib/content"
import type { ContentDoc } from "../../../lib/content"
import { DESCRIPTION_EXCERPT } from "../../../lib/seo/resolve"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import type { ContentEntryRecord } from "../../../modules/content/service"
import { contentPath } from "../../../workflows/content/paths"
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

/** Live entries, the newest first. Page SEO comes from `/store/seo/resolve`. */
export async function storeContentList(container: MedusaContainer, query: StoreGetContentType) {
  const [entries, count] = await service(container).listAndCountContentEntries(
    { status: "published", ...(query.kind ? { kind: query.kind } : {}) },
    {
      select: [...LIST_FIELDS],
      skip: query.offset,
      take: query.limit,
      order: { published_at: "DESC" },
    }
  )
  return { entries: entries.map(summary), count, offset: query.offset, limit: query.limit }
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
  const body = entry.body as unknown as ContentDoc
  return {
    ...summary(entry),
    html: renderDoc(body, await cardTargets(container, body)),
    // For a table of contents
    headings: docStats(body).headings,
  }
}
