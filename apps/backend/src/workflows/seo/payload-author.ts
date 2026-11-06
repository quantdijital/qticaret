import type { MedusaContainer } from "@medusajs/framework/types"
import type { PersonFacts } from "../../lib/seo/jsonld"
import type { SeoOverrides, SeoSubject } from "../../lib/seo/resolve"
import { postAuthorPath } from "../../lib/seo"
import { AUTHOR_FIELDS, livePostsOfAuthor } from "../content/author-reads"
import type { AuthorRow } from "../content/author-reads"
import { authorLinks, bioParagraphs } from "../content/author-rules"
import { SEO_FIELDS, imageOf, rowOf } from "./payload-sources"
import type { SeoMetaRow } from "./payload-sources"

// An author's page sits under the blog (docs/13 §2.2, adr/0060), as its archives do
const BLOG_TRAIL = [{ name: "Blog", path: "/blog" }]

// A page with no live post of the author's: kept out of search, its links followed
const NO_OVERRIDES: SeoOverrides = {
  seo_title: null,
  seo_description: null,
  canonical_override: null,
  robots_override: null,
  og_image_alt: null,
}

// A page with no bio of its own is described by the author's newest posts' titles
const DESCRIBING_POSTS = 5

/**
 * The structured data's person (adr/0060): name, page, title, photo, the
 * bio's first paragraph and their own pages. The page is a path here; the
 * payload makes it absolute once the host is known.
 */
export const personOf = (author: AuthorRow): PersonFacts => ({
  name: author.name,
  url: postAuthorPath(author.handle),
  jobTitle: author.job_title,
  image: author.image_url,
  description: bioParagraphs(author.bio)[0] ?? null,
  sameAs: authorLinks(author).map((link) => link.url),
})

/**
 * A blog author's page (`/blog/yazar/{handle}`, adr/0060): titled as a
 * post is (their name in its place), described by their bio, else their
 * newest posts; a `ProfilePage` about the `Person`, under the blog. The
 * storefront lists the posts itself; a page with no live post is nobody's
 * search result (noindex, its links followed).
 */
export async function authorSubject(
  container: MedusaContainer,
  id: string,
  path: string
): Promise<SeoSubject | null> {
  const author = await rowOf<AuthorRow & { updated_at?: string | Date; seo_meta?: SeoMetaRow }>(
    container,
    "content_author",
    [...AUTHOR_FIELDS, "updated_at", ...SEO_FIELDS],
    id
  )
  if (!author) {
    return null
  }
  const posts = await livePostsOfAuthor(container, id, DESCRIBING_POSTS)
  const own = author.seo_meta ?? null
  const bio = bioParagraphs(author.bio).join(" ")
  const description =
    bio || (posts.titles.length > 0 ? `${author.name} yazıları: ${posts.titles.join(", ")}.` : "")
  return {
    kind: "post_author",
    path,
    name: author.name,
    description,
    tokens: {},
    overrides:
      posts.count === 0 ? { ...(own ?? NO_OVERRIDES), robots_override: "noindex_follow" } : own,
    image: await imageOf(
      container,
      own,
      author.image_url ? { url: author.image_url, alt: author.name } : null
    ),
    trail: BLOG_TRAIL,
    profile: {
      person: personOf(author),
      dateModified: author.updated_at ? new Date(author.updated_at).toISOString() : null,
    },
  }
}
