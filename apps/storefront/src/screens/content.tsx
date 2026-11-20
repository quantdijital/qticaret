import type { Resolution } from "@qticaret/types"
import type { ContentPageView } from "@qticaret/ui"
import { addToCart } from "@/app/actions/cart"
import { sendContact } from "@/app/actions/contact"
import { subscribeNewsletter } from "@/app/actions/newsletter"
import { t } from "@/lib/i18n"
import { JsonLd } from "@/lib/seo/JsonLd"
import { authorView } from "@/lib/views/authors"
import type { ContentEntry } from "@/lib/store-api/content-entry"
import { storeGet } from "@/lib/store-api/server"
import { postMeta, shareLinks } from "@/lib/views/content-extras"
import { withOutline } from "@/lib/views/legal-outline"
import { pageAnchors } from "@/lib/views/page-anchors"
import { contentSections } from "@/lib/views/page-sections"
import { coverOf, postTerms } from "@/lib/views/posts"
import { withPictures } from "@/lib/views/prose-images"
import { breadcrumbsOf } from "@/lib/views/product"
import { theme } from "@/theme"
import { relatedPosts, textProducts } from "./content-data"

type Entity = Extract<Resolution, { type: "entity" }>

/**
 * A post's extras: its facts, a table of contents, its products, posts to
 * read next, share links, and its author's box (adr/0060).
 */
async function postExtras(entry: ContentEntry, page: Entity): Promise<Partial<ContentPageView>> {
  const [products, related] = await Promise.all([textProducts(entry.html), relatedPosts(entry)])
  return {
    ...withOutline(entry.html, pageAnchors()),
    post: postMeta(entry, t),
    author: entry.author ? authorView(entry.author, t) : null,
    products,
    related,
    share: shareLinks(page.seo?.canonical ?? null, entry.title, t),
  }
}

/**
 * A content page or blog post (F3.16): the backend's sanitised HTML
 * (adr/0019), a post's category and tags. A page is its sections from the
 * theme editor (adr/0073 Ek 2026-11-19 (2) K8), its own text and its
 * contact, payment and shipping parts among them, told by the sections
 * and not by the page's role. `entry`: the page already read (the theme
 * editor's live session's page in draft).
 */
export async function ContentScreen({
  page,
  entry: given,
}: {
  page: Entity
  entry?: ContentEntry
}) {
  const reading =
    given ??
    storeGet<{ entry: ContentEntry }>(`/store/content/${encodeURIComponent(page.entity_id)}`).then(
      (answer) => answer.entry
    )
  const [read, sections] = await Promise.all([
    reading,
    // A post takes no layout (adr/0073 §6); a page's is read beside it
    page.entity_type === "page" ? contentSections(page.entity_id, reading, t) : undefined,
  ])
  // The text's library pictures in their versions; the opening one eager without a cover above it
  const entry = {
    ...read,
    html: withPictures(read.html, read.images, { cover: Boolean(read.image_url) }),
  }
  const extras: Partial<ContentPageView> =
    entry.kind === "post" ? await postExtras(entry, page) : { sections: sections ?? [] }
  return (
    <>
      <JsonLd blocks={page.seo?.jsonLd ?? []} />
      <theme.ContentPage
        t={t}
        actions={{ sendContact }}
        subscribe={subscribeNewsletter}
        // As on the home page: a one-variant card says "Sepete ekle"
        quickAdd={addToCart}
        view={{
          title: entry.title,
          html: entry.html,
          publishedAt: entry.published_at,
          breadcrumbs: breadcrumbsOf(page.seo, t("home.label"), entry.title),
          ...postTerms(entry),
          image: coverOf(entry),
          ...extras,
        }}
      />
    </>
  )
}
