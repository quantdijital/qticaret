/** Text measures the rules share; Turkish-aware, pure. */

export const words = (text: string): string[] =>
  text
    .toLocaleLowerCase("tr")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

export const wordCount = (text: string): number => words(text).length

/** Mostly capital letters (a shouting title), judged on eight letters or more. */
export function isShouting(text: string): boolean {
  const letters = Array.from(text).filter((char) => /\p{L}/u.test(char))
  if (letters.length < 8) {
    return false
  }
  const upper = letters.filter((char) => char !== char.toLocaleLowerCase("tr")).length
  return upper / letters.length > 0.8
}

/** A word of three letters or more said three times or more. */
export function repeatedWord(text: string): string | null {
  const counts = new Map<string, number>()
  for (const word of words(text)) {
    if (word.length >= 3) {
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }
  for (const [word, count] of counts) {
    if (count >= 3) {
      return word
    }
  }
  return null
}

/** Runs of punctuation that read as noise (`!!`, `***`, `$$$`). */
export const hasSymbolRun = (text: string): boolean => /([!?*$%#@~^=+])\1/u.test(text)

export const includesFolded = (haystack: string, needle: string): boolean =>
  haystack.toLocaleLowerCase("tr").includes(needle.toLocaleLowerCase("tr").trim())
