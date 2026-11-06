import type { StoreBodyImage } from "@qticaret/types"
import { blocksOf } from "./faq"

/**
 * The pictures in the shop's text (adr/0019 HTML; docs/21 2026-11-06): a
 * picture the media library holds is printed as a product picture is, AVIF
 * and WebP `srcset`s with `sizes` before the original, its `width` and
 * `height` so nothing jumps while it loads. Every picture loads lazily but
 * the first when it opens the page (no cover above it, among the text's
 * first two blocks): that one may be the page's largest (LCP). A picture
 * the library does not know is left as the backend wrote it.
 */

/** A reading column: at most 46rem, the screen's width below it (both themes' measure). */
export const PROSE_IMAGE_SIZES = "(min-width: 48rem) 46rem, 100vw"

const IMG = /<img\s[^>]*>/g

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
}

const unescape = (value: string) =>
  value.replace(/&(amp|lt|gt|quot|#39);/g, (_, name: string) => ENTITIES[name] ?? "")

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`)

/** An attribute of the backend's tag (always double-quoted and escaped), read back. */
function attribute(tag: string, name: string): string | null {
  const found = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)
  return found?.[1] === undefined ? null : unescape(found[1])
}

const srcset = (entries: readonly { width: number; url: string }[] | undefined) =>
  entries && entries.length > 0
    ? [...entries]
        .sort((a, b) => a.width - b.width)
        .map((entry) => `${escape(entry.url)} ${String(entry.width)}w`)
        .join(", ")
    : null

const whole = (value: number | null) =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null

function picture(tag: string, image: StoreBodyImage | undefined, eager: boolean): string {
  const loading = eager ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"'
  if (!image) {
    return eager ? tag.replace(/\sloading="lazy"/, "").replace(/>$/, `${loading}>`) : tag
  }
  const width = whole(image.width)
  const height = whole(image.height)
  const size = width && height ? ` width="${String(width)}" height="${String(height)}"` : ""
  const img =
    `<img src="${escape(image.url)}" alt="${escape(attribute(tag, "alt") ?? "")}"` +
    `${size}${loading} decoding="async">`
  const sources = (["avif", "webp"] as const).flatMap((format) => {
    const set = srcset(image.derivatives?.srcset?.[format])
    return set
      ? [`<source type="image/${format}" srcset="${set}" sizes="${PROSE_IMAGE_SIZES}">`]
      : []
  })
  return sources.length > 0 ? `<picture>${sources.join("")}${img}</picture>` : img
}

/** True when the text's first picture is in its first two blocks. */
function opensWithPicture(html: string): boolean {
  const first = blocksOf(html).findIndex((block) => block.outer.includes("<img"))
  return first >= 0 && first <= 1
}

export function withPictures(
  html: string,
  images: readonly StoreBodyImage[] | undefined,
  { cover }: { cover: boolean } = { cover: true }
): string {
  if (!html.includes("<img")) {
    return html
  }
  const byUrl = new Map((images ?? []).map((image) => [image.url, image]))
  let eager = !cover && opensWithPicture(html)
  return html.replace(IMG, (tag) => {
    const src = attribute(tag, "src")
    const result = picture(tag, src === null ? undefined : byUrl.get(src), eager)
    eager = false
    return result
  })
}
