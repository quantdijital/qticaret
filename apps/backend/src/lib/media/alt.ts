import type { MessageLocale } from "../errors/messages"
import { isCleanText } from "../security"

/** What screen readers read comfortably; the alt route takes no more (docs/13 §8). */
export const ALT_MAX = 250

export interface AltSource {
  title: string
  /** The product's images in their order, with the variants each one shows. */
  images: readonly { variantIds: readonly string[] }[]
  /** A variant's option values in the product's option order, by variant id. */
  variantValues: ReadonlyMap<string, readonly string[]>
}

// The shop's words for an image told apart by its place (one language until F19)
const NUMBERED: Readonly<Record<MessageLocale, string>> = {
  tr: "{{text}}, görsel {{n}}",
  en: "{{text}}, image {{n}}",
}

const tidy = (text: string) => text.replace(/\s+/gu, " ").trim()

/**
 * The alt text each image would get from its product (docs/14 §4): the
 * product's name, with the option values of the one variant an image
 * shows ("Keten Gömlek – Beyaz / M"). Images that would read alike are
 * told apart by their place among them ("…, görsel 2"). Null for an image
 * whose text would not be clean (the alt route would refuse it).
 */
export function suggestedAlts(source: AltSource, locale: MessageLocale = "tr"): (string | null)[] {
  const title = tidy(source.title)
  const bases = source.images.map(({ variantIds }) => {
    const [only] = variantIds.length === 1 ? variantIds : []
    const values = only ? (source.variantValues.get(only) ?? []).map(tidy).filter(Boolean) : []
    return values.length > 0 ? `${title} – ${values.join(" / ")}` : title
  })
  const totals = new Map<string, number>()
  for (const base of bases) {
    totals.set(base, (totals.get(base) ?? 0) + 1)
  }
  const seen = new Map<string, number>()
  return bases.map((base) => {
    const place = (seen.get(base) ?? 0) + 1
    seen.set(base, place)
    const text =
      place > 1 && (totals.get(base) ?? 0) > 1
        ? NUMBERED[locale].replace("{{text}}", base).replace("{{n}}", String(place))
        : base
    const fitted = text.length > ALT_MAX ? text.slice(0, ALT_MAX).trimEnd() : text
    return fitted && isCleanText(fitted) ? fitted : null
  })
}
