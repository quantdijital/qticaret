import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { contentDoc } from "../../content/doc"
import { docPlainText } from "../../content/plain"
import { plainText } from "../../seo/text"
import { aiValidationError } from "../errors"
import { SEO_FACT_FIELDS, seoFactsOf } from "./seo"
import type { SeoRow } from "./seo"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * What may leave the shop of a blog post (adr/0071 §10, adr/0074 §4): its
 * title, its own summary, the body's opening as plain text (1500
 * characters, pictures and cards saying nothing) and its search fields.
 * The author (record or free name), the cover, the dates and the filing
 * are not read. A content page is no post: the kind is part of the
 * filter, so a page's id is turned away as unknown (and the other way
 * round, `facts/page.ts`).
 */

/** How much of the body goes, in characters. */
export const POST_BODY_FACT_LENGTH = 1_500

/** Only these: nothing of the author, the cover or the dates. */
export const POST_FACT_FIELDS = ["id", "title", "excerpt", "body", ...SEO_FACT_FIELDS] as const

interface PostRow {
  title?: string | null
  excerpt?: string | null
  body?: unknown
  seo_meta?: SeoRow | null
}

/** The body's opening as plain text; a body that is no document says nothing. */
function bodyText(body: unknown): string | null {
  const parsed = contentDoc.safeParse(body)
  if (!parsed.success) {
    return null
  }
  return docPlainText(parsed.data, POST_BODY_FACT_LENGTH).text.trim() || null
}

export async function postFacts(container: FactsContainer, id: string): Promise<RecordFacts> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "content_entry",
    fields: [...POST_FACT_FIELDS],
    filters: { id, kind: "post" },
  })
  const post = data[0] as PostRow | undefined
  if (!post) {
    throw aiValidationError("ai.unknown_entity")
  }
  return {
    name: post.title ?? null,
    summary: post.excerpt ? plainText(post.excerpt) || null : null,
    ...seoFactsOf(post.seo_meta),
    // Last: the longest field is the first the data block gives up when it is too long
    body: bodyText(post.body),
  }
}
