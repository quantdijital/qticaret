/**
 * Turkish-aware text keys for place names (adr/0008). Matching must treat
 * "istanbul", "İSTANBUL" and "İstanbul " as the same place, and lists must
 * sort in Turkish alphabetical order regardless of the database collation.
 */

const TR_LOCALE = "tr-TR"

/** Trims, collapses inner whitespace and composes characters (NFC). */
export function normalizeName(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ")
}

/** Case-insensitive comparison key using Turkish casing (i/İ, ı/I). */
export function trMatchKey(value: string): string {
  return normalizeName(value).toLocaleUpperCase(TR_LOCALE)
}

const NEIGHBORHOOD_SUFFIX = /\s+(MAHALLESİ|MAH\.?)$/u

/** Neighborhood key that ignores a trailing "Mah." / "Mahallesi". */
export function trNeighborhoodMatchKey(value: string): string {
  return trMatchKey(value).replace(NEIGHBORHOOD_SUFFIX, "")
}

// Turkish alphabet with q, w, x placed where Turkish dictionaries put them.
const ALPHABET = Array.from("abcçdefgğhıijklmnoöpqrsştuüvwxyz")
const SPACE_CODE = "00"
const UNKNOWN_CODE = "99"

/**
 * Sort key made of two-digit codes: space < digits < letters in Turkish
 * order. Digit-only keys sort the same under every collation, so plain
 * `ORDER BY sort_key` is correct even on a non-Turkish database.
 */
export function trSortKey(value: string): string {
  return Array.from(normalizeName(value).toLocaleLowerCase(TR_LOCALE))
    .map((char) => {
      if (char === " ") {
        return SPACE_CODE
      }
      if (char >= "0" && char <= "9") {
        return String(Number(char) + 1).padStart(2, "0")
      }
      const index = ALPHABET.indexOf(char)
      return index >= 0 ? String(index + 11) : UNKNOWN_CODE
    })
    .join("")
}

const ASCII_FOLD: Record<string, string> = {
  Ç: "C",
  Ğ: "G",
  İ: "I",
  Ö: "O",
  Ş: "S",
  Ü: "U",
  Â: "A",
  Î: "I",
  Û: "U",
}

/**
 * Match key with Turkish letters replaced by ASCII ones, for input typed
 * without Turkish characters ("Kadikoy" for "Kadıköy"). Lossy: use it only
 * as a fallback that must resolve to a single place.
 */
export function trAsciiFold(matchKey: string): string {
  return matchKey.replace(/[ÇĞİÖŞÜÂÎÛ]/gu, (char) => ASCII_FOLD[char] ?? char)
}
