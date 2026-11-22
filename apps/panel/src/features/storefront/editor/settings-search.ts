import type {
  AnySection,
  BodyGroup,
  LayoutDocument,
  LayoutGroup,
} from "@/features/storefront/api/layout"
import { sectionFields } from "./forms/field-registry"
import type { RegistryField } from "./forms/field-registry"
import { footerRowsFields } from "./footer-rows/footer-rows-fields"
import type { ThemeChoices } from "@/features/storefront/api/theme"
import { NO_SHOP_FLAGS, THEME_FIELDS, THEME_GROUP_TITLES } from "./forms/theme-registry"
import type { CardVariantsInUse, ShopFlags, ThemeRegistryField } from "./forms/theme-registry"
import { pageSectionsOf } from "@/features/storefront/layout/page-layouts"
import type { ShownPage } from "./editor-page"

/**
 * The theme editor's settings search (adr/0049 Ek 2026-11-14 §6): over the
 * page's parts as the list shows them (the header, the page's own
 * sections, the footer), by a section's name, its variants' names and its
 * fields' names and technical terms, from one register
 * (`field-registry.ts`). Turkish case and accents do not matter: "ı" finds
 * "i", "dis bosluk" finds "Dış boşluk", "MARGIN" finds it too.
 */

/** A text as the search compares it: Turkish lower case, accents and the dotless i let go. */
export const searchText = (text: string): string =>
  text
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ı/g, "i")
    .replace(/\s+/g, " ")
    .trim()

export interface SearchHit {
  section: AnySection
  group: LayoutGroup
  /** The field found; null: the section itself (its name). */
  field: RegistryField | null
  /** The choice whose name was found (a variant, a step); null: none. */
  option: string | null
}

type Translate = (key: string) => string

/** A section of the page's parts with its names, as the list shows them. */
export interface SearchedSection {
  section: AnySection
  group: LayoutGroup
  /** The row's name and the type's name (`sectionLabel`). */
  names: readonly string[]
}

/** The page's parts in the list's order: the header, the page's own sections, the footer. */
export const searchedGroups = (page: BodyGroup): readonly LayoutGroup[] => [
  "header",
  page,
  "footer",
]

const has = (haystack: string, words: readonly string[]) =>
  words.every((word) => haystack.includes(word))

/** At most this many hits: a short query on a full page is still a list one reads. */
export const SEARCH_LIMIT = 40

/**
 * What the query finds: each section whose name holds every word, then
 * each field whose name, term or a choice holds one of the words while the
 * section and the field together hold them all ("sss zemin": the FAQ's
 * ground), in the list's order.
 */
export function searchSettings(
  query: string,
  sections: readonly SearchedSection[],
  t: Translate
): SearchHit[] {
  const words = searchText(query).split(" ").filter(Boolean)
  if (words.length === 0) {
    return []
  }
  const hits: SearchHit[] = []
  for (const { section, group, names } of sections) {
    const name = searchText(names.join(" "))
    if (has(name, words)) {
      hits.push({ section, group, field: null, option: null })
    }
    // A free rows footer's rows and blocks are found too, each opening its own panel (adr/0070 §7)
    for (const field of [...sectionFields(section, group), ...footerRowsFields(section)]) {
      const found = fieldMatch(words, name, field, t)
      if (found) {
        hits.push({ section, group, field, option: found.option })
      }
    }
  }
  return hits.slice(0, SEARCH_LIMIT)
}

/**
 * Whether a field answers the words: its name, term, search-only words
 * (a theme field's `keywords`) or a choice holds one of them, the place's name and the field together all; with the choice
 * found, if any. Null: not a hit.
 */
function fieldMatch(
  words: readonly string[],
  name: string,
  field: Pick<RegistryField, "label" | "term" | "options"> & { keywords?: string | null },
  t: Translate
): { option: string | null } | null {
  const own = searchText(
    [field.label, field.term ?? "", field.keywords ?? ""]
      .map((key) => (key ? t(key) : ""))
      .join(" ")
  )
  const option = field.options.find((key) =>
    words.some((word) => searchText(t(key)).includes(word))
  )
  const text = `${own} ${option ? searchText(t(option)) : ""}`
  return words.some((word) => text.includes(word)) && has(`${name} ${text}`, words)
    ? { option: option ?? null }
    : null
}

/** A theme setting found (colours, faces, corners, the card): opens the theme panel at it. */
export interface ThemeHit {
  theme: true
  field: ThemeRegistryField
  option: string | null
}

/**
 * What the query finds among the theme's settings (adr/0049 Ek
 * 2026-11-15), as among a section's: "tema" and the panel's name find
 * every field with the rest of the words, "köşe" the corners. Only the
 * fields the panel shows now (`shown`).
 */
export function searchTheme(
  query: string,
  theme: ThemeChoices,
  variants: CardVariantsInUse,
  t: Translate,
  // The shop's flags that are on: a dated card's fields only with `catalog.booking`
  flags: ShopFlags = NO_SHOP_FLAGS
): ThemeHit[] {
  const words = searchText(query).split(" ").filter(Boolean)
  if (words.length === 0) {
    return []
  }
  const name = searchText(t("storefront.editor.theme.title"))
  return THEME_FIELDS.flatMap((field) => {
    if (!field.shown(theme, variants, flags)) {
      return []
    }
    const found = fieldMatch(
      words,
      `${name} ${searchText(t(THEME_GROUP_TITLES[field.group]))}`,
      field,
      t
    )
    return found ? [{ theme: true as const, field, option: found.option }] : []
  })
}

/** Every hit: the page's parts first, then the theme's settings, at most `SEARCH_LIMIT`. */
export const allHits = (
  sections: readonly SearchHit[],
  theme: readonly ThemeHit[]
): (SearchHit | ThemeHit)[] => [...sections, ...theme].slice(0, SEARCH_LIMIT)

/**
 * The page's parts the search looks through, named as the list names
 * them; a content page's own sections between the header and the footer
 * (adr/0073 §5).
 */
export function searchedSections(
  doc: LayoutDocument,
  page: ShownPage,
  namesOf: (section: AnySection, group: LayoutGroup) => readonly string[]
): SearchedSection[] {
  const groups: readonly LayoutGroup[] =
    typeof page === "string" ? searchedGroups(page) : ["header", "pages", "footer"]
  return groups.flatMap((group) => {
    const sections: readonly AnySection[] =
      group !== "pages"
        ? doc[group]
        : typeof page === "string" || page.content === null
          ? []
          : pageSectionsOf(doc, page.content)
    return sections.map((section) => ({ section, group, names: namesOf(section, group) }))
  })
}
