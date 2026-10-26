/** A template filled with sample values, for previews (no SDK, tested on its own). */

const TOKEN = /\{([^{}]*)\}/gu
const MAX_VALUE_LENGTH = 1000

// The server's tidying (apps/backend/src/lib/seo/template.ts), so a preview
// reads as the storefront will: empty tokens drop out with their joiners,
// a doubled full stop folds. Keep the two copies in step.
const JOINERS = "|›»>/·•–—~-"
const JOINER = String.raw`[|›»>/·•–—~\-]`
const JOINER_RUN = new RegExp(String.raw`\s*${JOINER}(?:\s*${JOINER})+`, "gu")
const strongest = (run: string): string => {
  const found = Array.from(run).filter((char) => JOINERS.includes(char))
  const best = found.reduce((a, b) => (JOINERS.indexOf(b) < JOINERS.indexOf(a) ? b : a))
  return ` ${best}`
}
const SENTENCE_END_THEN_STOP = /(?<!\.)([.!?…])\s*\.(?!\.)/gu
const JOINER_THEN_PUNCT = new RegExp(String.raw`\s*${JOINER}\s*([.,:;])`, "gu")
const PUNCT_THEN_JOINER = new RegExp(String.raw`\s*[,:;]\s*(${JOINER})`, "gu")
const LEADING = new RegExp(String.raw`^(?:\s|${JOINER}|[.,:;])+`, "u")
const TRAILING_LEFTOVER = new RegExp(String.raw`[\s,:;]|${JOINER}`, "u")

function trimTrailing(text: string): string {
  let end = text.length
  while (end > 0 && TRAILING_LEFTOVER.test(text.charAt(end - 1))) {
    end -= 1
  }
  return text.slice(0, end)
}

function tidy(text: string): string {
  const collapsed = text
    .replace(/\s+/gu, " ")
    .replace(JOINER_RUN, strongest)
    .replace(SENTENCE_END_THEN_STOP, "$1")
    .replace(JOINER_THEN_PUNCT, "$1")
    .replace(PUNCT_THEN_JOINER, " $1")
    .replace(/\s+([.,:;!?])/gu, "$1")
    .replace(LEADING, "")
  return trimTrailing(collapsed)
}

/** Fills a template as the server does: missing values drop out with their separators. */
export function renderTemplate(
  template: string,
  values: Readonly<Record<string, string | null | undefined>>
): string {
  const filled = template.normalize("NFC").replace(TOKEN, (_match, name: string) => {
    const value = Object.hasOwn(values, name) ? values[name] : undefined
    return (value ?? "").normalize("NFC").trim().slice(0, MAX_VALUE_LENGTH)
  })
  return tidy(filled)
}

/** Fills tokens with `samples` (i18n `settings.seo.samples` or a page's own values), the shop's name for {mağaza}. */
export function renderSample(
  template: string,
  storeName: string,
  samples: Readonly<Record<string, string>>
): string {
  return renderTemplate(template, { ...samples, mağaza: storeName })
}

/** Tokens each template may use, as the server checks them (lib/seo/template). */
export const TEMPLATE_TOKENS = {
  product: [
    "ürün_adı",
    "marka",
    "mağaza",
    "kategori",
    "öne_çıkan_attribute",
    "kısa_açıklama",
    "fiyat_cümlesi",
    "kargo_cümlesi",
  ],
  category: ["kategori", "mağaza"],
  brand: ["marka", "mağaza"],
  page: ["başlık", "mağaza"],
  post: ["başlık", "mağaza"],
} as const
