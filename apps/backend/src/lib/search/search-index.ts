import { normalizeText, trigrams, wordsOf } from "./normalize"

/**
 * A catalogue's words, indexed once per load for site search (adr/0046 ek
 * 2026-11-03): every product's fields as word ids with their weights, and
 * each distinct word once with its trigrams, how it reads and how many
 * titles hold it. Searching then weighs a query word against the
 * vocabulary once and each product by lookups: ~O(products × words).
 */

/** What search reads of a product. */
export interface SearchDoc {
  id: string
  title: string
  subtitle?: string | null
  /** Plain text or simple HTML; its start only is read. */
  description?: string | null
  brand?: { id: string; name: string; handle: string } | null
  categories?: { id: string; name: string }[]
  /** Attribute values as shown or as slugs (`paslanmaz_celik`). */
  attributes?: string[]
}

/** How much a word found in each field counts (exact match in the title: 3). */
export const FIELD_WEIGHTS = {
  title: 3,
  brand: 2,
  category: 2,
  attribute: 1,
  text: 0.5,
} as const

/** Characters of the description read: its opening says what the product is. */
export const DESCRIPTION_EXCERPT = 240

export interface IndexedField {
  weight: number
  /** Word ids, each once. */
  words: number[]
}

export interface IndexedDoc {
  doc: SearchDoc
  fields: IndexedField[]
  /** The title as compared, for a whole-phrase match. */
  title: string
  /** Every word id of every field, for checking a suggestion finds something. */
  all: ReadonlySet<number>
}

export interface SearchIndex {
  docs: IndexedDoc[]
  /** By word id: the word as compared, its trigrams, as it reads, titles holding it. */
  words: string[]
  grams: string[][]
  display: string[]
  titleCount: number[]
  ids: ReadonlyMap<string, number>
  byId: ReadonlyMap<string, IndexedDoc>
}

const TAGS = /<[^>]*>|&[a-z]+;|&#\d+;/gi

const excerptOf = (text: string | null | undefined): string =>
  (text ?? "").replace(TAGS, " ").slice(0, DESCRIPTION_EXCERPT)

export function buildSearchIndex(docs: readonly SearchDoc[]): SearchIndex {
  const index: SearchIndex & { ids: Map<string, number>; byId: Map<string, IndexedDoc> } = {
    docs: [],
    words: [],
    grams: [],
    display: [],
    titleCount: [],
    ids: new Map(),
    byId: new Map(),
  }
  // A word's look from a title wins: suggestions are made of title words
  const fromTitle: boolean[] = []

  const idsOf = (text: string, isTitle: boolean): number[] => {
    const found = new Set<number>()
    for (const word of wordsOf(text)) {
      let id = index.ids.get(word.norm)
      if (id === undefined) {
        id = index.words.length
        index.ids.set(word.norm, id)
        index.words.push(word.norm)
        index.grams.push(trigrams(word.norm))
        index.display.push(word.display)
        index.titleCount.push(0)
        fromTitle.push(isTitle)
      } else if (isTitle && !fromTitle[id]) {
        index.display[id] = word.display
        fromTitle[id] = true
      }
      found.add(id)
    }
    return [...found]
  }

  for (const doc of docs) {
    const title = idsOf(doc.title, true)
    for (const id of title) {
      index.titleCount[id] = (index.titleCount[id] ?? 0) + 1
    }
    const fields: IndexedField[] = [
      { weight: FIELD_WEIGHTS.title, words: title },
      { weight: FIELD_WEIGHTS.brand, words: idsOf(doc.brand?.name ?? "", false) },
      {
        weight: FIELD_WEIGHTS.category,
        words: idsOf((doc.categories ?? []).map((category) => category.name).join(" "), false),
      },
      { weight: FIELD_WEIGHTS.attribute, words: idsOf((doc.attributes ?? []).join(" "), false) },
      {
        weight: FIELD_WEIGHTS.text,
        words: idsOf(`${doc.subtitle ?? ""} ${excerptOf(doc.description)}`, false),
      },
    ].filter((field) => field.words.length > 0)
    const entry: IndexedDoc = {
      doc,
      fields,
      title: normalizeText(doc.title),
      all: new Set(fields.flatMap((field) => field.words)),
    }
    index.docs.push(entry)
    index.byId.set(doc.id, entry)
  }
  return index
}
