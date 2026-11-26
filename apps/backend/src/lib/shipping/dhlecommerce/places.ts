/**
 * DHL eCommerce's il and ilçe codes (CBS Info, `getcities`,
 * `getdistricts/{cityCode}`), which an order's recipient names alongside
 * the names. DHL's names carry the plate as a suffix ("ADANA  11"); ours
 * are Medusa's (adr/0008: il in `province`, ilçe in `city`). Both sides are
 * compared folded: lower case, Turkish letters to their Latin pair, the
 * trailing plate dropped, spaces single. The lists themselves are asked of
 * DHL and kept a day (`./client`).
 */

/** One il or ilçe as CBS Info lists it. */
export interface DhlEcomPlace {
  code: number
  name: string
}

const LATIN: Readonly<Record<string, string>> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  i̇: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
}

/** A place name folded for comparison: "İSTANBUL  34" and "istanbul" alike. */
export function foldPlace(name: string): string {
  return name
    .toLocaleLowerCase("tr")
    .normalize("NFC")
    .replace(/i̇|[çğıöşüâîû]/g, (char) => LATIN[char] ?? char)
    .replace(/\s+\d+\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** The place of the list named `name`; null when none is, or the name is empty. */
export function findPlace(list: readonly DhlEcomPlace[], name: string): DhlEcomPlace | null {
  const wanted = foldPlace(name)
  if (wanted === "") {
    return null
  }
  return list.find((place) => foldPlace(place.name) === wanted) ?? null
}

/** A CBS Info row as a place, its code a whole number; null for a row that is none. */
export function placeOf(row: unknown): DhlEcomPlace | null {
  const record = row as { code?: unknown; name?: unknown } | null
  const code = Number(record?.code)
  return Number.isSafeInteger(code) && code > 0 && typeof record?.name === "string"
    ? { code, name: record.name }
    : null
}

/** The city code as `getdistricts` takes it in its path: two digits ("01"…"81"). */
export const cityPathCode = (code: number): string => String(code).padStart(2, "0")
