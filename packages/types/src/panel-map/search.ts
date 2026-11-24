import type { PanelMapEntry } from "./types"

/**
 * Finding a screen by the everyday words people type (adr/0079 Y1-0): "kargo
 * ücreti" finds Ayarlar › Kargo ve teslimat › Seçenekler ve ücretler. No AI:
 * words of the map matched by their beginnings, Turkish letters and case
 * folded, the name weighing most, then the keywords, then the trail and help.
 */

/** Lower case without accents, Turkish letters folded: "İade Şartları" → "iade sartlari". */
export function foldText(text: string): string {
  return (
    text
      .normalize("NFD")
      // Accents, cedillas, breves and İ's dot go with the marks; ı has none to lose
      .replace(/\p{M}/gu, "")
      .replace(/ı/g, "i")
      .toLowerCase()
  )
}

/**
 * The words of a text, folded; a word written with a hyphen or an
 * apostrophe also counts whole ("e-posta" is "e", "posta" and "eposta").
 */
export function wordsOf(text: string): string[] {
  const words: string[] = []
  for (const chunk of foldText(text).split(/\s+/)) {
    const parts = chunk.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
    words.push(...parts)
    if (parts.length > 1) {
      words.push(parts.join(""))
    }
  }
  return words
}

/** How much a typed word found in each part of a screen counts: the name most. */
export const WEIGHTS = { label: 4, keyword: 3, trail: 1, help: 1 } as const
/**
 * The whole of what was typed starting the name or one keyword: a phrase,
 * not loose words; one more when it is all of it.
 */
const PHRASE_BONUS = { label: 3, keyword: 2 } as const
/** At most this many screens: the menu stays a short list. */
export const SEARCH_LIMIT = 8

export interface PanelSearchOptions<Entry extends PanelMapEntry> {
  /** A label key's text in the panel's language. */
  text: (key: string) => string
  /** Whose help is read; both languages' keywords always are. */
  language: "tr" | "en"
  /** Whether the signed-in staff member is offered the screen (its flag and capability). */
  allowed: (screen: Entry) => boolean
  limit?: number
  /**
   * A sentence rather than a few typed letters (the assistant's query): a
   * screen needs only some of its words, a word may carry a suffix
   * ("ücretini"), and words of under three letters are left out.
   */
  loose?: boolean
}

export interface PanelSearchHit<Entry extends PanelMapEntry> {
  screen: Entry
  /** The screens it sits under, the outermost first. */
  trail: Entry[]
  score: number
}

/** The screens a screen sits under in `byKey`, the outermost first. */
export function trailIn<Entry extends PanelMapEntry>(
  screen: Entry,
  byKey: ReadonlyMap<string, Entry>
): Entry[] {
  const trail: Entry[] = []
  let parent = screen.parent
  while (parent) {
    const above = byKey.get(parent)
    if (!above || trail.includes(above)) {
      break
    }
    trail.unshift(above)
    parent = above.parent
  }
  return trail
}

const startsAny = (words: readonly string[], typed: string) =>
  words.some((word) => word.startsWith(typed))

/** Loose: a typed word shorter than this is left out. */
const LOOSE_MIN_WORD = 3

// Loose, a typed word may also carry a suffix past the map's word ("ucretini" for "ucret")
const takesAny = (words: readonly string[], typed: string) =>
  words.some(
    (word) => word.startsWith(typed) || (word.length >= LOOSE_MIN_WORD && typed.startsWith(word))
  )

/**
 * Loose, a sentence is never one keyword whole, so the phrase bonus does
 * not reach it: a keyword of several words all met in the sentence ("kargo
 * ücreti" in "kargo ücreti nereden değişir") counts its further words once
 * more, the best such keyword only. Words scattered over a screen ("kargo"
 * beginning "kargoya ver", a name's word) then do not outrank it.
 */
function wholeKeywordBonus(keywords: readonly string[], typed: readonly string[]): number {
  let most = 0
  for (const keyword of keywords) {
    // As the sentence's own: a word under three letters ("e" of "e-posta") is not asked for
    const words = wordsOf(keyword).filter((word) => word.length >= LOOSE_MIN_WORD)
    if (words.length > 1 && words.every((word) => typed.some((each) => takesAny([word], each)))) {
      most = Math.max(most, WEIGHTS.keyword * (words.length - 1))
    }
  }
  return most
}

/**
 * The screens matching every typed word by a word's beginning, best first
 * (ties keep the map's order), offered to this staff member: a screen
 * under one they may not open is not offered either. `loose` (the
 * assistant's `find_screen`, whose query is a sentence) counts the words
 * a screen has and passes over the others.
 */
export function searchPanelMap<Entry extends PanelMapEntry>(
  query: string,
  screens: readonly Entry[],
  options: PanelSearchOptions<Entry>
): PanelSearchHit<Entry>[] {
  const loose = options.loose === true
  // Loose, a short word ("ve", "to") would begin half the map's words: it is left out
  const typed = [...new Set(wordsOf(query))].filter(
    (word) => !loose || word.length >= LOOSE_MIN_WORD
  )
  if (typed.length === 0) {
    return []
  }
  const phrase = typed.join(" ")
  const byKey = new Map(screens.map((screen) => [screen.key, screen]))
  const hits: PanelSearchHit<Entry>[] = []
  for (const screen of screens) {
    const trail = trailIn(screen, byKey)
    if (!options.allowed(screen) || !trail.every((above) => options.allowed(above))) {
      continue
    }
    const label = options.text(screen.label)
    const keywords = [...screen.keywords.tr, ...screen.keywords.en]
    const fields = {
      label: wordsOf(label),
      keyword: keywords.flatMap(wordsOf),
      trail: trail.flatMap((above) => wordsOf(options.text(above.label))),
      help: wordsOf(screen.help[options.language]),
    }
    let score = 0
    let all = true
    for (const word of typed) {
      const best = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[])
        .filter((field) => (loose ? takesAny : startsAny)(fields[field], word))
        .reduce((most, field) => Math.max(most, WEIGHTS[field]), 0)
      if (best === 0 && !loose) {
        all = false
        break
      }
      score += best
    }
    if (!all || score === 0) {
      continue
    }
    // What was typed as a whole: one more when it is the whole name or keyword ("kvkk")
    const phraseIn = (text: string) => {
      const words = wordsOf(text).join(" ")
      return words === phrase ? 1 : words.startsWith(phrase) ? 0 : -1
    }
    const inLabel = phraseIn(label)
    const inKeyword = Math.max(-1, ...keywords.map(phraseIn))
    if (inLabel >= 0) {
      score += PHRASE_BONUS.label + inLabel
    } else if (inKeyword >= 0) {
      score += PHRASE_BONUS.keyword + inKeyword
    }
    if (loose) {
      score += wholeKeywordBonus(keywords, typed)
    }
    hits.push({ screen, trail, score })
  }
  // Array.prototype.sort is stable: equal scores keep the map's order
  return hits.sort((one, other) => other.score - one.score).slice(0, options.limit ?? SEARCH_LIMIT)
}

/** The first sentence of a help text, shown under a result. */
export function firstSentence(text: string): string {
  const end = text.search(/[.!?](\s|$)/)
  return end === -1 ? text : text.slice(0, end + 1)
}
