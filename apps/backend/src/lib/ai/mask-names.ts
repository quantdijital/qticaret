/**
 * A review's or a question's author named in its own words, masked before
 * the text reaches an AI service (adr/0071 §10; Aşama 9). The pattern
 * filter (`redactPersonalData`) catches an e-mail or a phone number, never
 * a name: this takes out the names the shop knows, its authors' (as the
 * storefront shows them, "Ayşe K."). Another person named in the text has
 * no list to match and is not caught; nor is a name written with a suffix
 * glued on ("Ayşenin"). What else goes is limited by the readers: the
 * words and the rating only, never a name, contact, order or customer field.
 */

export const NAME_MASK = "[…]"

// A part shorter than this is an initial ("K."), masked nowhere: a single letter is everywhere
const MIN_PART = 2
const MAX_PARTS = 200

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const capitalised = (part: string) =>
  part.charAt(0).toLocaleUpperCase("tr") + part.slice(1).toLocaleLowerCase("tr")

/** The parts of the names worth masking, each in the ways Turkish writes it. */
export function nameVariants(names: readonly string[]): string[] {
  const variants = new Set<string>()
  for (const name of names) {
    for (const part of name.split(/[^\p{L}'’-]+/u)) {
      const word = part.replace(/^['’-]+|['’-]+$/g, "")
      if (Array.from(word).length < MIN_PART) {
        continue
      }
      for (const form of [
        word,
        word.toLocaleLowerCase("tr"),
        word.toLocaleUpperCase("tr"),
        capitalised(word),
      ]) {
        variants.add(form)
      }
    }
  }
  return [...variants].slice(0, MAX_PARTS)
}

/** The text with each name part as a whole word replaced by `[…]`. */
export function maskNames(text: string, names: readonly string[]): string {
  const variants = nameVariants(names)
  if (variants.length === 0 || text === "") {
    return text
  }
  // Longest first, so "Ayşegül" is not left as "[…]gül" by "Ayşe"
  const alternatives = variants
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|")
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, "giu")
  return text.replace(pattern, NAME_MASK)
}
