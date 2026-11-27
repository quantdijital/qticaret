import type { PageTextSectionView } from "@qticaret/ui"

/**
 * The ids the theme writes fixed on a content, legal or post page and its
 * frame (the skip link's `main`, the header's search, the footer's
 * newsletter, the cookie notice, the text sections' own boxes, a legal
 * text's and a post's parts). A heading's anchor made from the shop's
 * words never takes one of them (the storefront seeds its anchors with
 * these), so a link to it and the skip link land where they say.
 */
export const PAGE_FIXED_IDS: readonly string[] = [
  // The frame
  "icerik",
  "arama-genis",
  "bulten",
  "bulten-alt",
  "bulten-blok",
  "footer-contact",
  "cerez-baslik",
  // A content page's own text sections
  "icindekiler",
  "yardim",
  "bize-ulasin",
  "kunye",
  "iletisim-formu",
  "iletisim-ad",
  "iletisim-eposta",
  "iletisim-telefon",
  "iletisim-konu",
  "iletisim-siparis",
  "iletisim-mesaj",
  "iletisim-hata",
  "odeme-yontemleri",
  "taksit-secenekleri",
  "guvencelerimiz",
  "kargo-firmalari",
  // A legal text's and a post's parts
  "diger-metinler",
  "etiketler",
  "paylas",
  "yazidaki-urunler",
  "ilgili-yazilar",
  "yazar-hakkinda",
]

/** Which of a page's text sections draws the same fixed ids as another of its kind. */
const familyOf = (section: PageTextSectionView): string =>
  section.type === "rich_text" ? (section.faq ? "faq" : "article") : section.type

/**
 * What each of a page's text sections adds to its fixed ids, so two of a
 * kind on one page do not share them: nothing for the first of its kind
 * (a page of one text draws as before), `--2`, `--3` for the later ones.
 * A heading's anchor never holds `--` (`anchorOf` folds a run of signs
 * into one), so these never meet one.
 */
export function idSuffixes(
  sections: readonly PageTextSectionView[]
): ReadonlyMap<PageTextSectionView, string> {
  const seen = new Map<string, number>()
  const suffixes = new Map<PageTextSectionView, string>()
  for (const section of sections) {
    const family = familyOf(section)
    const n = (seen.get(family) ?? 0) + 1
    seen.set(family, n)
    suffixes.set(section, n > 1 ? `--${String(n)}` : "")
  }
  return suffixes
}
