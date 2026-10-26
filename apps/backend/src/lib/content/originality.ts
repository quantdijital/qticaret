/**
 * How much of a landing page's text is its own (docs/14 L-UNIQ-01, docs/13
 * §7): a programmatic page that repeats another's text is thin content.
 * Each text keeps a fingerprint: the count of its five-word runs
 * (shingles) and a MinHash signature of them. Two fingerprints estimate
 * the share of one text found in the other, in constant time and the same
 * way every time; the full texts are never compared.
 */

// Changing it makes stored fingerprints incomparable: every page would read as its own
export const SIGNATURE_SIZE = 128

/** docs/14 L-UNIQ-01: under 40% of its own text a landing page warns; under 30% it is not published. */
export const ORIGINALITY = { warn: 40, block: 30 } as const
const SHINGLE_WORDS = 5
const WORD = /[\p{L}\p{N}]+/gu

export interface Fingerprint {
  /** Distinct shingles in the text. */
  size: number
  /** The smallest hash per seed; empty for a text with no words. */
  signature: number[]
}

// FNV-1a over the UTF-16 units: a stable 32-bit hash of a shingle
function hashText(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// murmur3's finaliser: one shingle hash and a seed give one of SIGNATURE_SIZE hashes
function mix(value: number, seed: number): number {
  let hash = (value ^ Math.imul(seed + 1, 0x9e3779b1)) >>> 0
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return hash >>> 0
}

const NAME_PLACEHOLDER = " ad "
// A shorter name (`Ev`) would also stand for the start of unrelated words
const MIN_NAME_LENGTH = 3
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g

// A name at a word's start, its suffixes left (`seramikten` → `ad ten`): Turkish adds to the end
function withoutNames(text: string, names: readonly string[]): string {
  return names
    .map((name) => name.trim().toLocaleLowerCase("tr"))
    .filter((name) => name.length >= MIN_NAME_LENGTH)
    .sort((a, b) => b.length - a.length)
    .reduce(
      (current, name) =>
        current.replace(
          new RegExp(`(?<![\\p{L}\\p{N}])${name.replace(REGEX_SPECIAL, "\\$&")}`, "gu"),
          NAME_PLACEHOLDER
        ),
      text.toLocaleLowerCase("tr")
    )
}

/** The text's distinct five-word runs, hashed; a shorter text is one run. */
export function shinglesOf(text: string): Set<number> {
  const words = text.toLocaleLowerCase("tr").match(WORD) ?? []
  const shingles = new Set<number>()
  if (words.length === 0) {
    return shingles
  }
  const last = Math.max(0, words.length - SHINGLE_WORDS)
  for (let start = 0; start <= last; start++) {
    shingles.add(hashText(words.slice(start, start + SHINGLE_WORDS).join(" ")))
  }
  return shingles
}

/**
 * The text's fingerprint. `names` (the facet's, the category's) read as one
 * placeholder: a template with only the names swapped is the same text.
 */
export function fingerprint(text: string, names: readonly string[] = []): Fingerprint {
  const shingles = shinglesOf(withoutNames(text, names))
  if (shingles.size === 0) {
    return { size: 0, signature: [] }
  }
  const signature = Array.from({ length: SIGNATURE_SIZE }, () => 0xffffffff)
  for (const shingle of shingles) {
    for (let seed = 0; seed < SIGNATURE_SIZE; seed++) {
      const hashed = mix(shingle, seed)
      if (hashed < (signature[seed] ?? 0xffffffff)) {
        signature[seed] = hashed
      }
    }
  }
  return { size: shingles.size, signature }
}

/**
 * The share of `own`'s shingles also in `other`, 0–1: from the signatures'
 * Jaccard estimate J and the sizes, as |A∩B| = J·(|A|+|B|)/(1+J).
 */
export function sharedShare(own: Fingerprint, other: Fingerprint): number {
  if (own.size === 0 || other.size === 0 || own.signature.length !== other.signature.length) {
    return 0
  }
  const equal = own.signature.filter((hash, seed) => hash === other.signature[seed]).length
  const jaccard = equal / own.signature.length
  const common = (jaccard * (own.size + other.size)) / (1 + jaccard)
  return Math.min(1, common / own.size)
}

/** The text's own share, 0–100: what is left after the page it most resembles. No text is none. */
export function originality(own: Fingerprint, others: readonly Fingerprint[]): number {
  if (own.size === 0) {
    return 0
  }
  const most = others.reduce((max, other) => Math.max(max, sharedShare(own, other)), 0)
  return Math.round((1 - most) * 100)
}
