/**
 * Realistic Turkish test data (docs/07): names, phones, addresses and
 * identity numbers that pass the same checks real ones do, from a seeded
 * generator so a failing test repeats. Nothing here belongs to a person:
 * the TCKNs are computed, not collected, and the phones sit in the 0532
 * 000 range no operator hands out.
 */

/** mulberry32: small, fast, good enough for fixtures; not for secrets. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(random: () => number, items: readonly T[]): T => {
  const item = items[Math.floor(random() * items.length)]
  if (item === undefined) {
    throw new Error("pick from an empty list")
  }
  return item
}

const digit = (random: () => number) => Math.floor(random() * 10)

/**
 * An 11-digit TCKN with valid check digits: the first is not 0; the tenth
 * is (7 × odd places − even places) mod 10; the eleventh the sum of the
 * first ten mod 10.
 */
export function fakeTckn(random: () => number = Math.random): string {
  const digits = [1 + Math.floor(random() * 9), ...Array.from({ length: 8 }, () => digit(random))]
  const odd = digits.filter((_, index) => index % 2 === 0).reduce((sum, value) => sum + value, 0)
  const even = digits.filter((_, index) => index % 2 === 1).reduce((sum, value) => sum + value, 0)
  const tenth = (((odd * 7 - even) % 10) + 10) % 10
  digits.push(tenth)
  digits.push(digits.reduce((sum, value) => sum + value, 0) % 10)
  return digits.join("")
}

/** A 10-digit VKN with a valid check digit (GİB's algorithm). */
export function fakeVkn(random: () => number = Math.random): string {
  const digits = Array.from({ length: 9 }, () => digit(random))
  let sum = 0
  digits.forEach((value, index) => {
    const shifted = (value + 9 - index) % 10
    let weighted = (shifted * 2 ** (9 - index)) % 9
    if (shifted !== 0 && weighted === 0) {
      weighted = 9
    }
    sum += weighted
  })
  digits.push((10 - (sum % 10)) % 10)
  return digits.join("")
}

const FIRST_NAMES = [
  "Ayşe",
  "Mehmet",
  "Zeynep",
  "Mustafa",
  "Elif",
  "Ahmet",
  "Şule",
  "Çağrı",
  "Gökhan",
]
const LAST_NAMES = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Öztürk", "Aydın", "Güneş"]
const PLACES = [
  { province: "İstanbul", district: "Kadıköy", postal: "34710" },
  { province: "Ankara", district: "Çankaya", postal: "06690" },
  { province: "İzmir", district: "Karşıyaka", postal: "35560" },
  { province: "Bursa", district: "Nilüfer", postal: "16110" },
  { province: "Antalya", district: "Muratpaşa", postal: "07040" },
]
const STREETS = ["Atatürk Cad.", "Cumhuriyet Mah. Gül Sok.", "İnönü Bulvarı", "Bağdat Cad."]

export interface TrPerson {
  firstName: string
  lastName: string
  email: string
  /** E.164, in a range no operator assigns. */
  phone: string
  tckn: string
}

export interface TrAddress {
  address1: string
  district: string
  province: string
  postalCode: string
  countryCode: "tr"
}

const ascii = (text: string) =>
  text
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")

export function trPerson(random: () => number = Math.random): TrPerson {
  const firstName = pick(random, FIRST_NAMES)
  const lastName = pick(random, LAST_NAMES)
  const number = String(Math.floor(random() * 10_000)).padStart(4, "0")
  return {
    firstName,
    lastName,
    // example.com never delivers (RFC 2606); no Turkish letters (PayTR's email rule)
    email: `${ascii(firstName)}.${ascii(lastName)}${number}@example.com`,
    phone: `+90532000${number}`,
    tckn: fakeTckn(random),
  }
}

export function trAddress(random: () => number = Math.random): TrAddress {
  const place = pick(random, PLACES)
  return {
    address1: `${pick(random, STREETS)} No: ${String(1 + Math.floor(random() * 120))} D: ${String(1 + Math.floor(random() * 20))}`,
    district: place.district,
    province: place.province,
    postalCode: place.postal,
    countryCode: "tr",
  }
}
