/**
 * What an alt text suggestion may not carry, over the shared checks
 * (lib/ai/gate.ts): a second line, and the filler a screen reader already
 * says ("görsel", "resmi", "fotoğrafı", "image of"): the reader announces
 * an image, the text says what is in it (docs/13 §8).
 */

// Whole words, in any case and with any suffix a Turkish noun takes here
const FILLER_STEMS = ["görsel", "resim", "resmi", "fotoğraf", "foto"] as const
const FILLER_WORDS: ReadonlySet<string> = new Set([
  "image",
  "images",
  "picture",
  "photo",
  "photograph",
])
// The suffixes a filler noun takes in an alt text ("görseli", "fotoğrafında", "resimde")
const SUFFIX =
  /^(i|ı|u|ü|si|sı|de|da|te|ta|dir|dır|nde|nda|ndeki|ndaki|deki|daki|inde|ında|indeki|ındaki|ler|lar|leri|ları)?$/u

const wordsOf = (text: string): string[] => text.match(/[\p{L}\p{N}]+/gu) ?? []

// In Turkish "Image" lowers to "ımage": the English words are matched in the plain lowering
const isFiller = (word: string): boolean => {
  const turkish = word.toLocaleLowerCase("tr")
  return (
    FILLER_WORDS.has(word.toLowerCase()) ||
    FILLER_STEMS.some((stem) => turkish.startsWith(stem) && SUFFIX.test(turkish.slice(stem.length)))
  )
}

/** The alt text's own problems; an empty list passes. */
export function altTextProblems(text: string): string[] {
  const problems: string[] = []
  if (text.includes("\n")) {
    problems.push("lines")
  }
  if (wordsOf(text).some(isFiller)) {
    problems.push("filler")
  }
  return problems
}
