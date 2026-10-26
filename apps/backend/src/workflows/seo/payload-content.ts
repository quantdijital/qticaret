import type { MedusaContainer } from "@medusajs/framework/types"
import type { SeoSubject } from "../../lib/seo/resolve"
import { SEO_FIELDS, imageOf, rowOf } from "./payload-sources"
import type { SeoMetaRow } from "./payload-sources"

interface ContentRow {
  id: string
  kind: "page" | "post"
  title: string
  excerpt?: string | null
  body_summary: string
  author_name?: string | null
  image_url?: string | null
  image_alt?: string | null
  published_at?: string | Date | null
  revised_at?: string | Date | null
  seo_meta?: SeoMetaRow | null
}

const iso = (value: string | Date | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null

// Blog posts sit under the blog's own page (docs/13 §2.2), which the storefront serves;
// its name follows the shop's language once there are more (F19)
const BLOG_TRAIL = [{ name: "Blog", path: "/blog" }]

/**
 * A content page's or blog post's subject (F3.16): described by its own
 * summary, else its opening text; shared with its own image, else its
 * cover; a post is an article with its author and dates.
 */
export async function contentSubject(
  container: MedusaContainer,
  id: string,
  path: string
): Promise<SeoSubject | null> {
  const entry = await rowOf<ContentRow>(
    container,
    "content_entry",
    [
      "id",
      "kind",
      "title",
      "excerpt",
      "body_summary",
      "author_name",
      "image_url",
      "image_alt",
      "published_at",
      "revised_at",
      ...SEO_FIELDS,
    ],
    id
  )
  if (!entry) {
    return null
  }
  const image = await imageOf(
    container,
    entry.seo_meta,
    entry.image_url ? { url: entry.image_url, alt: entry.image_alt ?? null } : null
  )
  return {
    kind: entry.kind,
    path,
    name: entry.title,
    description: entry.excerpt ?? entry.body_summary,
    tokens: {},
    overrides: entry.seo_meta ?? null,
    image,
    trail: entry.kind === "post" ? BLOG_TRAIL : [],
    article: {
      type: entry.kind === "post" ? "BlogPosting" : "WebPage",
      headline: entry.title,
      datePublished: iso(entry.published_at),
      dateModified: iso(entry.revised_at),
      author: entry.author_name ?? null,
      image: image?.url ?? null,
    },
  }
}
