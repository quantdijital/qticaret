import type { BrandLinkView, BrandsPageView, ImageView } from "@qticaret/ui"
import type { StoreBrand } from "@qticaret/types"
// A value from the subpath: the root re-exports with `.js` specifiers Turbopack cannot follow
import { brandLogoSize } from "@qticaret/types/catalog"

const TURKISH = new Intl.Collator("tr")
const GRAPHEMES = new Intl.Segmenter("tr", { granularity: "grapheme" })

// Letters of the Turkish alphabet that carry a mark of their own; other marks fold (Â → A)
const OWN_LETTERS = new Set(["Ç", "Ğ", "İ", "Ö", "Ş", "Ü"])

/**
 * A brand's logo as a theme draws it, or null: the shop's own upload, one
 * file with no versions. Its size, when the server read it, lets the theme
 * save its room before it loads; unknown, the logo waits for its file as it
 * did before sizes were kept.
 */
export function brandLogo(brand: StoreBrand, alt: string): ImageView | null {
  if (!brand.logo_url) {
    return null
  }
  const size = brandLogoSize(brand)
  return {
    src: brand.logo_url,
    alt,
    width: size?.width ?? null,
    height: size?.height ?? null,
    sources: { avif: null, webp: null },
  }
}

/**
 * The letter a brand is listed under: its first, upper case as Turkish
 * writes it (`ı` → I, `i` → İ), other languages' marks dropped; null when
 * the name starts with no letter (a digit, a sign).
 */
export function letterOf(name: string): string | null {
  const [first] = Array.from(
    GRAPHEMES.segment(name.trim().normalize("NFC")),
    (each) => each.segment
  )
  if (first === undefined || !/^\p{L}/u.test(first)) {
    return null
  }
  const upper = first.toLocaleUpperCase("tr")
  return OWN_LETTERS.has(upper) ? upper : upper.normalize("NFD").replace(/\p{M}/gu, "")
}

/**
 * The brands by first letter (`/markalar`), letters in the Turkish
 * alphabet's order and the names in each as a Turkish reader sorts them;
 * names that start with no letter last, under `other`. A brand without a
 * live path is left out; a logo shows beside the name, which says it all
 * (the picture's alt text is empty).
 */
export function brandGroups(
  brands: readonly StoreBrand[],
  paths: Record<string, string>,
  other: string
): BrandsPageView["groups"] {
  const groups = new Map<string | null, BrandLinkView[]>()
  for (const brand of brands) {
    const path = paths[brand.id]
    if (!path) {
      continue
    }
    const letter = letterOf(brand.name)
    const link: BrandLinkView = {
      label: brand.name,
      path,
      logo: brandLogo(brand, ""),
    }
    groups.set(letter, [...(groups.get(letter) ?? []), link])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : TURKISH.compare(a, b)))
    .map(([letter, links], index) => ({
      letter: letter ?? other,
      anchor: `harf-${String(index + 1)}`,
      brands: links.sort((a, b) => TURKISH.compare(a.label, b.label)),
    }))
}
