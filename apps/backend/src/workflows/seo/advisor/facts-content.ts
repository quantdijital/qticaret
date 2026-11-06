import type { MedusaContainer } from "@medusajs/framework/types"
import { docStats, renderDoc } from "../../../lib/content"
import type { ContentDoc } from "../../../lib/content"
import type { AdvisorFacts } from "../../../lib/seo/advisor"
import { writtenDetails } from "../../../lib/shop/written-details"
import type { ShopContact } from "../../../lib/shop/written-details"
import { authorsByIds } from "../../content/author-reads"
import { contentPath } from "../../content/paths"
import { legalIdentity } from "../../legal/identity"
import { seoPayloadFor } from "../payload"
import { activePathOf } from "../redirects/owners"
import { OWN_FIELDS, duplicates, rowOf } from "./facts-common"
import type { Own } from "./facts-common"

interface ContentRow {
  id: string
  kind: "page" | "post"
  title: string
  handle: string
  status: "draft" | "published"
  body: ContentDoc
  author_name?: string | null
  author_id?: string | null
  /** Its author's record, read beside it (adr/0060). */
  author?: { name: string; bio: string | null } | null
  image_url?: string | null
  image_alt?: string | null
  published_at?: string | Date | null
  revised_at?: string | Date | null
  seo_meta?: Own | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/** The document as the content rules read it, with the cover counted among its images. */
function articleFacts(
  row: ContentRow,
  now: Date,
  contact: ShopContact
): NonNullable<AdvisorFacts["article"]> {
  const stats = docStats(row.body)
  const cover = row.image_url ? 1 : 0
  const changed = row.revised_at ?? row.published_at
  return {
    words: stats.words,
    openingWords: stats.openingWords,
    headings: stats.headings,
    paragraphs: stats.paragraphs,
    internalLinks: stats.links.internal + stats.cards.product.length + stats.cards.category.length,
    lists: stats.lists,
    tables: stats.tables,
    images: stats.images.length + cover,
    imagesWithoutAlt:
      stats.images.filter((image) => !image.alt).length + (cover && !row.image_alt?.trim() ? 1 : 0),
    // The author's record names them (adr/0060); the old text stands in for a post without one
    author: row.author?.name ?? row.author_name ?? null,
    authorRecord: row.author ? { hasBio: Boolean(row.author.bio?.trim()) } : null,
    published: row.status === "published",
    ageDays: changed ? Math.floor((now.getTime() - new Date(changed).getTime()) / DAY_MS) : null,
    writtenDetails: writtenDetails(stats.text, contact),
  }
}

/**
 * A content page's or blog post's facts (F3.16, docs/14 §3.8): the search
 * result text as resolve builds it, and its document as `lib/content`
 * reads it. An entry of the other kind under this id is no page of this one.
 */
export async function contentFacts(
  container: MedusaContainer,
  kind: "page" | "post",
  id: string,
  now: Date = new Date()
): Promise<(AdvisorFacts & { isListed: boolean }) | null> {
  const row = await rowOf<ContentRow>(
    container,
    "content_entry",
    [
      "id",
      "kind",
      "title",
      "handle",
      "status",
      "body",
      "author_name",
      "author_id",
      "image_url",
      "image_alt",
      "published_at",
      "revised_at",
      ...OWN_FIELDS,
    ],
    id
  )
  if (row?.kind !== kind) {
    return null
  }
  if (row.author_id) {
    row.author = (await authorsByIds(container, [row.author_id])).get(row.author_id) ?? null
  }
  const owner = { entity_type: kind, entity_id: id }
  const path = (await activePathOf(container, owner)) ?? contentPath(row)
  const seo = await seoPayloadFor(container, owner, path)
  const own = row.seo_meta ?? null
  const identity = await legalIdentity(container)
  const stats = docStats(row.body)
  const noindex = own?.robots_override?.startsWith("noindex") ?? false
  const title = seo?.title ?? row.title
  const description = seo?.description ?? ""
  return {
    isListed: row.status === "published" && !noindex && !own?.canonical_override,
    kind,
    name: row.title,
    handle: row.handle,
    title,
    titleIsOwn: Boolean(own?.seo_title),
    description,
    descriptionIsOwn: Boolean(own?.seo_description),
    body: stats.text,
    bodyHtml: renderDoc(row.body),
    focusKeyword: own?.focus_keyword ?? null,
    duplicates: await duplicates(container, kind, id, { title, description }),
    noindex,
    article: articleFacts(row, now, {
      phone: identity.contact_phone,
      whatsapp: identity.whatsapp_phone,
      email: identity.contact_email,
    }),
  }
}
