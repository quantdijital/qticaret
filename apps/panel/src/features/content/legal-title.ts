/**
 * Whether a page's title reads like one of the shop's legal texts (F13):
 * the contracts, the KVKK and cookie notices, the return and shipping
 * policies are made from the shop's details under Settings > Legal and
 * published at `/yasal/...`; written again as a content page, the shop
 * would show two versions of one text. Matched without Turkish letters
 * too, as people type them both ways.
 */
const LEGAL_WORDS: readonly RegExp[] = [
  /sozlesme/,
  /kvkk/,
  /aydinlatma/,
  /cerez/,
  /gizlilik/,
  /kisisel veri/,
  /on bilgilendirme/,
  /iade (ve degisim )?(politika|kosul)/,
  /iade ve degisim/,
  /kargo ve iade/,
  /(kargo|teslimat) (ve teslimat )?politika/,
  /kullanim kosul/,
  /sartlar ve kosullar/,
  /cayma/,
]

const ASCII: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" }

const plain = (text: string): string =>
  text
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (letter) => ASCII[letter] ?? letter)
    .replace(/\s+/g, " ")

export const looksLikeLegalText = (title: string): boolean => {
  const text = plain(title)
  return LEGAL_WORDS.some((word) => word.test(text))
}
