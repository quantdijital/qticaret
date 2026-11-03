import type { Block, ContentDoc, Inline } from "../content"
import { checkTemplate } from "../seo/template"

/**
 * The shop's legal texts (F13.1, adr/0041 §1) and the `{belirteç}`s they
 * are written with. A text is checked when saved, so an unknown token is
 * refused then rather than printed in a contract.
 */

export const LEGAL_KINDS = [
  "distance_sales",
  "pre_information",
  "privacy_notice",
  "cookie_policy",
  "return_policy",
  "shipping_policy",
  "membership",
] as const
export type LegalKind = (typeof LEGAL_KINDS)[number]

export const isLegalKind = (value: string): value is LegalKind =>
  (LEGAL_KINDS as readonly string[]).includes(value)

/**
 * What a web shop must have published before it sells (adr/0041 §1): the
 * contracts of an order, the privacy notice and the return policy. The
 * SEO setup checklist asks for them too.
 */
export const REQUIRED_KINDS: readonly LegalKind[] = [
  "distance_sales",
  "pre_information",
  "privacy_notice",
  "return_policy",
]

/** The contracts made with an order: their copy is kept with it, filled with the order (F13.2). */
export const ORDER_KINDS: ReadonlySet<LegalKind> = new Set(["pre_information", "distance_sales"])

/** Filled wherever the text is shown: the shop's own details. */
export const SHOP_TOKENS = [
  "mağaza_adı",
  "mağaza_unvanı",
  "mersis",
  "vkn",
  "vergi_dairesi",
  "adres",
  "kep",
  "etbis",
  "e_posta",
  "telefon",
  "alan_adı",
  "iade_süresi",
  "bugün",
] as const

/** Filled only in the copy kept with an order. */
export const ORDER_TOKENS = [
  "alıcı_adı",
  "alıcı_e_posta",
  "alıcı_telefon",
  "teslimat_adresi",
  "fatura_adresi",
  "sipariş_no",
  "sipariş_tarihi",
  "sipariş_kalemleri",
  "ara_toplam",
  "kargo_ücreti",
  "indirim",
  "toplam",
  "ödeme_yöntemi",
] as const

/**
 * The block the server places in an order's contracts, in their withdrawal
 * clause, for lines made to the buyer's wish (adr/0052 §8). No order token:
 * the shop never writes it, the checker refuses it in a text.
 */
export const PERSONAL_LINES_TOKEN = "kişiye_özel_ürünler"

/** A token that stands for blocks (a table of lines), written alone in its paragraph. */
export const BLOCK_TOKENS: ReadonlySet<string> = new Set([
  "sipariş_kalemleri",
  PERSONAL_LINES_TOKEN,
])

export type ShopToken = (typeof SHOP_TOKENS)[number]
export type OrderToken = (typeof ORDER_TOKENS)[number]

/** The tokens a kind may use: an order's only in the contracts made with one. */
export const tokensFor = (kind: LegalKind): readonly string[] =>
  ORDER_KINDS.has(kind) ? [...SHOP_TOKENS, ...ORDER_TOKENS] : SHOP_TOKENS

function* textsOf(blocks: readonly Block[]): Generator<string> {
  for (const block of blocks) {
    const content = (block as { content?: readonly unknown[] }).content ?? []
    for (const child of content) {
      const node = child as Inline | Block
      if (node.type === "text") {
        yield node.text
      } else if (node.type !== "hardBreak") {
        yield* textsOf([node])
      }
    }
  }
}

export interface LegalTemplateCheck {
  unknownTokens: string[]
  isMalformed: boolean
}

/**
 * The text's tokens against the kind's. A token split by formatting (half
 * of it bold) reads as malformed: it is written again in one piece.
 */
export function checkLegalDoc(doc: ContentDoc, kind: LegalKind): LegalTemplateCheck {
  const allowed = tokensFor(kind)
  const unknown = new Set<string>()
  let isMalformed = false
  for (const text of textsOf(doc.content)) {
    const check = checkTemplate(text, allowed)
    check.unknownTokens.forEach((token) => unknown.add(token))
    isMalformed ||= check.isMalformed
  }
  return { unknownTokens: [...unknown], isMalformed }
}
