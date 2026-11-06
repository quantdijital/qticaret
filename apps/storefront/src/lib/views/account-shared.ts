import type { ImageView, Translate } from "@qticaret/ui"

// What the account pages share: dates in Turkish, a status in words, a line's photo

export const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

/** An order line's photo as a picture, its title the words. */
export const thumbnailOf = (src: string, alt: string): ImageView => ({
  src,
  alt,
  width: null,
  height: null,
  sources: { avif: null, webp: null },
})

/** A status's words (`prefix` + value), or the value itself when no text is kept for it. */
export function said(t: Translate, prefix: string, value: string): string {
  const key = `${prefix}${value}`
  const text = t(key)
  return text === key ? value : text
}
