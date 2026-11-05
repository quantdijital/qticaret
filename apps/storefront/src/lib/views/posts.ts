import type { ImageView, LinkView, PostCardView, Translate } from "@qticaret/ui"
import type { StoreContentSummary, StoreContentTerm } from "@qticaret/types"
import { imageView } from "./image"

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

type Cover = Pick<
  StoreContentSummary,
  "image_url" | "image_alt" | "image_width" | "image_height" | "image_derivatives"
>

/** A post's or page's cover with its size and versions when its media record has them. */
export const coverOf = (entry: Cover): ImageView | null =>
  entry.image_url
    ? imageView(
        {
          url: entry.image_url,
          alt: entry.image_alt,
          width: entry.image_width ?? null,
          height: entry.image_height ?? null,
          derivatives: entry.image_derivatives ?? null,
        },
        ""
      )
    : null

/** Blog posts as cards (D10): the date and the reading time in words, the category at its archive. */
export function postCards(entries: StoreContentSummary[], t: Translate): PostCardView[] {
  return entries.map((entry) => ({
    title: entry.title,
    path: entry.path,
    excerpt: entry.excerpt,
    image: coverOf(entry),
    date: entry.published_at ? DATE.format(new Date(entry.published_at)) : null,
    dateTime: entry.published_at,
    reading: t("blog.reading", { minutes: entry.reading_minutes }),
    category: entry.category ? termLink(entry.category) : null,
  }))
}

const termLink = (term: StoreContentTerm): LinkView => ({ label: term.name, path: term.path })

/** A post's category and tags as links to their archives (adr/0019 ek 2026-11-03). */
export const postTerms = (entry: {
  category?: StoreContentTerm | null
  tags?: StoreContentTerm[]
}): { category: LinkView | null; tags: LinkView[] } => ({
  category: entry.category ? termLink(entry.category) : null,
  tags: (entry.tags ?? []).map(termLink),
})
