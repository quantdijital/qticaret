/**
 * The shop's details a text written in the panel may stand in for
 * (adr/0048): `{telefon}` in an announcement or a page shows the number as
 * the store details say it now, so a change is made once. The names and
 * the `{name}` form are the backend's (`lib/shop/tokens.ts`), in its order.
 */
export const SHOP_TOKENS = [
  "mağaza_adı",
  "telefon",
  "e_posta",
  "adres",
  "whatsapp",
  "ücretsiz_kargo_eşiği",
] as const

export type ShopToken = (typeof SHOP_TOKENS)[number]

/** Each token's text key (`shopTokens.names.*`): the names themselves are Turkish words. */
export const SHOP_TOKEN_KEYS: Readonly<Record<ShopToken, string>> = {
  mağaza_adı: "shopName",
  telefon: "phone",
  e_posta: "email",
  adres: "address",
  whatsapp: "whatsapp",
  ücretsiz_kargo_eşiği: "freeShippingThreshold",
}

/** What each detail shows now; null: the shop has not given it. */
export type ShopTokenValues = Readonly<Partial<Record<string, string | null>>>

// The server's own pattern: letters, digits and `_` between braces
const TOKEN = /\{([\p{L}\p{N}_]+)\}/gu
const KNOWN: ReadonlySet<string> = new Set(SHOP_TOKENS)
// Control and format characters never reach the page through a value
const INVISIBLE = /[\p{Cc}\p{Cf}]/gu

const tokensIn = (text: string): string[] =>
  [...text.normalize("NFC").matchAll(TOKEN)].map(([, name = ""]) => name)

/** Whether the text uses any `{name}`, known or not. */
export const hasShopToken = (text: string): boolean => tokensIn(text).length > 0

/** The `{name}`s the text uses that are no shop detail: the server refuses them. */
export const unknownShopTokens = (text: string): string[] => [
  ...new Set(tokensIn(text).filter((name) => !KNOWN.has(name))),
]

/** The text as the storefront shows it: a known detail filled in (nothing when not given), an unknown one left as typed. */
export function fillShopText(text: string, values: ShopTokenValues): string {
  return text
    .normalize("NFC")
    .replace(TOKEN, (whole, name: string) =>
      KNOWN.has(name) ? (values[name] ?? "").replace(INVISIBLE, "").trim() : whole
    )
}

/** `{name}` in place of the selection (`start`…`end`), and where the caret goes after it. */
export function insertToken(
  text: string,
  name: ShopToken,
  start: number,
  end: number = start
): { text: string; caret: number } {
  const token = `{${name}}`
  const from = Math.max(0, Math.min(start, text.length))
  const to = Math.max(from, Math.min(end, text.length))
  return { text: text.slice(0, from) + token + text.slice(to), caret: from + token.length }
}
