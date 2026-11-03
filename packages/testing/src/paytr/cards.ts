/**
 * The cards the fake PayTR's form takes (README.md): the program a card
 * belongs to read from its first six digits (a snapshot of known BIN
 * prefixes, not PayTR's full list), and a few numbers that decide the
 * bank's answer. Any other number that passes the Luhn check is paid.
 */

export const CARD_FAMILIES = [
  "axess",
  "bonus",
  "cardfinans",
  "maximum",
  "paraf",
  "world",
  "advantage",
  "combo",
] as const

export type CardFamily = (typeof CARD_FAMILIES)[number]

/** The bank's answer to a card: paid, refused, or refused for its limit. */
export type CardOutcome = "success" | "refused" | "insufficient"

/** What the fake keeps of a card: never the number, as PayTR shows the shop. */
export interface FakeCard {
  /** The program (`world` ...); null for a card in none, which pays in one go. */
  family: CardFamily | null
  /** `kart_marka` as the status query and the statement write it. */
  brand: string
  bin: string
  last4: string
}

const BINS: Readonly<Record<CardFamily, readonly string[]>> = {
  axess: ["435508", "540667", "552608", "520932"],
  bonus: ["540036", "554960", "460345", "472915"],
  cardfinans: ["402277", "531157", "979203"],
  maximum: ["454359", "418342", "450634"],
  paraf: ["552879", "492128"],
  world: ["455359", "415792", "545103", "450803"],
  advantage: ["550472", "552143"],
  combo: ["540709", "979210"],
}

/** The numbers README.md lists, with the answer each gets. */
export const TEST_CARDS: readonly { number: string; outcome: CardOutcome; note: string }[] = [
  { number: "4355084355084358", outcome: "success", note: "Axess, Visa" },
  { number: "5406675406675403", outcome: "success", note: "Axess, Mastercard" },
  { number: "5400360000000003", outcome: "success", note: "Bonus" },
  { number: "4022774022774026", outcome: "success", note: "CardFinans" },
  { number: "9792030394440796", outcome: "success", note: "CardFinans, Troy" },
  { number: "4543590000000006", outcome: "success", note: "Maximum" },
  { number: "5528790000000008", outcome: "success", note: "Paraf" },
  { number: "4157920000000002", outcome: "success", note: "World" },
  { number: "5504720000000003", outcome: "success", note: "Advantage" },
  { number: "5407090000000009", outcome: "success", note: "Bankkart Combo" },
  { number: "4129111111111111", outcome: "refused", note: "Visa, programsız" },
  { number: "4111111111111129", outcome: "insufficient", note: "Visa, programsız" },
]

/** The card PayTR's test mode fills in, as its own form does. */
export const PREFILLED_CARD = {
  owner: "PAYTR TEST",
  number: "4355084355084358",
  expiry: "12/30",
  cvv: "000",
}

/** A payment completed without the form (a test's `pay`): a World card. */
export const DEFAULT_CARD_NUMBER = "4553590633526747"

export const digitsOf = (text: string): string => text.replace(/[\s-]/g, "")

export function passesLuhn(number: string): boolean {
  if (!/^\d{13,19}$/.test(number)) {
    return false
  }
  let sum = 0
  for (let i = 0; i < number.length; i += 1) {
    let digit = Number(number[number.length - 1 - i])
    if (i % 2 === 1) {
      digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2
    }
    sum += digit
  }
  return sum % 10 === 0
}

/** The program a BIN belongs to, if the fake knows it. */
export function familyOf(bin: string): CardFamily | null {
  return CARD_FAMILIES.find((family) => BINS[family].includes(bin.slice(0, 6))) ?? null
}

/** The scheme a number belongs to, for a card in no program. */
function schemeOf(number: string): string {
  if (number.startsWith("4")) {
    return "VISA"
  }
  if (/^(5[1-5]|2[2-7])/.test(number)) {
    return "MASTERCARD"
  }
  if (number.startsWith("9792")) {
    return "TROY"
  }
  return /^3[47]/.test(number) ? "AMEX" : "KART"
}

export function cardOf(number: string): FakeCard {
  const digits = digitsOf(number)
  const family = familyOf(digits)
  return {
    family,
    brand: family ? family.toUpperCase() : schemeOf(digits),
    bin: digits.slice(0, 6),
    last4: digits.slice(-4),
  }
}

/** The card a payment shows: the one typed on the form, else the default World card. */
export const cardOfPayment = (payment: { card?: FakeCard }): FakeCard =>
  payment.card ?? cardOf(DEFAULT_CARD_NUMBER)

export function outcomeOf(number: string): CardOutcome {
  const digits = digitsOf(number)
  return TEST_CARDS.find((card) => card.number === digits)?.outcome ?? "success"
}

/** The scheme's 3-D Secure name, as the bank's page heads itself. */
export function secureSchemeOf(bin: string): string {
  const scheme = schemeOf(bin)
  const names: Record<string, string> = {
    VISA: "Visa Secure",
    MASTERCARD: "Mastercard Identity Check",
    TROY: "TROY 3D Secure",
    AMEX: "American Express SafeKey",
  }
  return names[scheme] ?? "3D Secure"
}

/** "455359******6747": the status query's `masked_pan` and the statement's `kart_no`. */
export const maskedPan = (card: FakeCard): string => `${card.bin}******${card.last4}`

/** "4355 08** **** 4358": the card as the bank's 3-D Secure page shows it. */
export const spacedPan = (card: FakeCard): string =>
  `${card.bin.slice(0, 4)} ${card.bin.slice(4)}** **** ${card.last4}`

/** The program's name as the form shows it beside the number. */
export const FAMILY_NAMES: Readonly<Record<CardFamily, string>> = {
  axess: "Axess",
  bonus: "Bonus",
  cardfinans: "CardFinans",
  maximum: "Maximum",
  paraf: "Paraf",
  world: "World",
  advantage: "Advantage",
  combo: "Bankkart Combo",
}

/** Every known BIN with its program: the form reads the program as the number is typed. */
export const BIN_TABLE: Readonly<Record<string, CardFamily>> = Object.fromEntries(
  CARD_FAMILIES.flatMap((family) => BINS[family].map((bin) => [bin, family]))
)
