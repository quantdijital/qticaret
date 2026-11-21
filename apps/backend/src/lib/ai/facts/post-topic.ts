/**
 * How near a link candidate's name is to a blog post's subject (adr/0074
 * Ek 7, G5 takip): the words of the post's focus keyword weigh most, then
 * those of its title, then its summary's. Words are compared by a rough
 * Turkish stem: lower case in Turkish (`İ` → `i`, `I` → `ı`), a suffix
 * after an apostrophe dropped ("Termos'un"), marks folded (`ç` → `c`,
 * `ı` → `i`, `â` → `a`, so "bicak" meets "bıçak"), the first five letters,
 * and a softened last consonant made hard again ("bıçağı" meets "bıçak").
 * Short words and words that say nothing of a subject (ve, ile, için…) are
 * left out. A name holding the focus keyword's words in a row earns more.
 * A tie keeps the list's own order: the same post ranks the same way.
 */

export interface PostTopic {
  title?: string | null
  focusKeyword?: string | null
  summary?: string | null
}

export interface TopicStems {
  /** Each stem of the post's words and its weight, the highest of where it appears. */
  weights: ReadonlyMap<string, number>
  /** The focus keyword's stems in a row, when it has two or more. */
  phrase: string | null
}

/** A stem's weight by where in the post it appears. */
export const TOPIC_WEIGHTS = { focusKeyword: 3, title: 2, summary: 1 } as const

/** What a name holding the whole focus keyword in a row earns besides its stems. */
export const PHRASE_BONUS = 3

/** A word shorter than this is not matched. */
const MIN_WORD = 3
/** The letters a stem keeps (Turkish suffixes vary). */
const STEM_LENGTH = 5

/** A text as the matching reads it: Turkish lower case, apostrophe suffixes off, marks folded. */
export function foldText(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/(?<=[\p{L}\p{N}])['’]\p{L}+/gu, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/gu, "i")
}

// Words that say nothing of a subject, folded as the text is
const STOP_WORDS = new Set(
  [
    "ve",
    "veya",
    "ile",
    "için",
    "bir",
    "bu",
    "şu",
    "o",
    "da",
    "de",
    "en",
    "çok",
    "daha",
    "gibi",
    "ama",
    "her",
    "mı",
    "mi",
    "nasıl",
    "nedir",
    "neden",
    "nelerdir",
    "hangi",
    "hangisi",
    "rehber",
    "rehberi",
    "ipucu",
    "ipuçları",
    "yol",
    "yolu",
    "yolları",
  ].map(foldText)
)

// After folding: g was ğ (or g), b, d and c soften from k (ğ), p, t, ç before a vowel
const HARDENED: Readonly<Record<string, string>> = { g: "k", b: "p", d: "t" }
const VOWEL = /[aeiou]/u

/** One folded word's stem: its first letters, a softened last one hardened before a vowel. */
function stemOf(word: string): string {
  const stem = word.slice(0, STEM_LENGTH)
  const last = stem.at(-1) ?? ""
  const next = word.charAt(stem.length)
  const hard = HARDENED[last]
  return hard !== undefined && stem.length === STEM_LENGTH && VOWEL.test(next)
    ? `${stem.slice(0, -1)}${hard}`
    : stem
}

/** A text's stems in their order, repeats kept. */
export function stemListOf(text: string): string[] {
  return foldText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= MIN_WORD && !STOP_WORDS.has(word))
    .map(stemOf)
}

/** A text's stems, each once. */
export const stemsOf = (text: string): Set<string> => new Set(stemListOf(text))

/** The post's subject as weighed stems. */
export function topicOf(topic: PostTopic): TopicStems {
  const weights = new Map<string, number>()
  for (const part of ["summary", "title", "focusKeyword"] as const) {
    for (const stem of stemsOf(topic[part] ?? "")) {
      weights.set(stem, Math.max(weights.get(stem) ?? 0, TOPIC_WEIGHTS[part]))
    }
  }
  const phrase = stemListOf(topic.focusKeyword ?? "")
  return { weights, phrase: phrase.length >= 2 ? phrase.join(" ") : null }
}

/** How near a name is to the post: its stems' weights, and the phrase's bonus. */
export function scoreOf(name: string, topic: TopicStems): number {
  let score = 0
  for (const stem of stemsOf(name)) {
    score += topic.weights.get(stem) ?? 0
  }
  if (topic.phrase !== null && ` ${stemListOf(name).join(" ")} `.includes(` ${topic.phrase} `)) {
    score += PHRASE_BONUS
  }
  return score
}

/** The candidates nearest the post first; a tie keeps the list's own order. */
export function ranked<T extends { name: string }>(
  candidates: readonly T[],
  topic: TopicStems
): T[] {
  return candidates
    .map((each, index) => ({ each, index, score: scoreOf(each.name, topic) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ each }) => each)
}
