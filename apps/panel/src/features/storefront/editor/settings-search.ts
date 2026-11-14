import type {
  AnySection,
  BodyGroup,
  LayoutDocument,
  LayoutGroup,
} from "@/features/storefront/api/layout"
import { sectionFields } from "./forms/field-registry"
import type { RegistryField } from "./forms/field-registry"

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
    for (const field of sectionFields(section, group)) {
      const own = searchText(
        [field.label, field.term ?? ""].map((key) => (key ? t(key) : "")).join(" ")
      )
      const option = field.options.find((key) =>
        words.some((word) => searchText(t(key)).includes(word))
      )
      const text = `${own} ${option ? searchText(t(option)) : ""}`
      if (words.some((word) => text.includes(word)) && has(`${name} ${text}`, words)) {
        hits.push({ section, group, field, option: option ?? null })
      }
    }
  }
  return hits.slice(0, SEARCH_LIMIT)
}

/** The page's parts the search looks through, named as the list names them. */
export function searchedSections(
  doc: LayoutDocument,
  page: BodyGroup,
  namesOf: (section: AnySection, group: LayoutGroup) => readonly string[]
): SearchedSection[] {
  return searchedGroups(page).flatMap((group) =>
    (doc[group] as readonly AnySection[]).map((section) => ({
      section,
      group,
      names: namesOf(section, group),
    }))
  )
}
