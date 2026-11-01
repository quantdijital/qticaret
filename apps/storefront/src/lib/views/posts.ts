import type { PostCardView, Translate } from "@qticaret/ui"
import type { StoreContentSummary } from "@qticaret/types"

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

/** Blog posts as cards (D10): the date and the reading time in words. */
export function postCards(entries: StoreContentSummary[], t: Translate): PostCardView[] {
  return entries.map((entry) => ({
    title: entry.title,
    path: entry.path,
    excerpt: entry.excerpt,
    image: entry.image_url
      ? {
          src: entry.image_url,
          alt: entry.image_alt ?? "",
          width: null,
          height: null,
          sources: { avif: null, webp: null },
        }
      : null,
    date: entry.published_at ? DATE.format(new Date(entry.published_at)) : null,
    dateTime: entry.published_at,
    reading: t("blog.reading", { minutes: entry.reading_minutes }),
  }))
}
