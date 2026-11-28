import type { Block, ContentDoc, Inline } from "../content"

/**
 * The shop's details a text written in the panel stands in for (adr/0048):
 * `{telefon}` in an announcement, a page or a post shows the number as the
 * store details say it now, so a change is made once. The `{belirteç}`
 * form and the names are the legal texts' own (adr/0041 §1); the shipping
 * days and the withdrawal period read as the legal texts print them
 * ("1–2 iş günü", "14"), so a starter page can cite them.
 */
export const SHOP_INFO_TOKENS = [
  "mağaza_adı",
  "telefon",
  "e_posta",
  "adres",
  "whatsapp",
  "ücretsiz_kargo_eşiği",
  "hazırlama_süresi",
  "kargo_süresi",
  "iade_süresi",
] as const

export type ShopInfoToken = (typeof SHOP_INFO_TOKENS)[number]
export type ShopInfoValues = Readonly<Record<ShopInfoToken, string | null>>

const TOKEN = /\{([\p{L}\p{N}_]+)\}/gu
const KNOWN: ReadonlySet<string> = new Set(SHOP_INFO_TOKENS)

// Control and format characters never reach the page through a value
const INVISIBLE = /[\p{Cc}\p{Cf}]/gu

/** The `{name}`s a text uses that are no shop detail: refused when it is saved. */
export function unknownShopTokens(text: string): string[] {
  const unknown = new Set<string>()
  for (const [, name = ""] of text.normalize("NFC").matchAll(TOKEN)) {
    if (!KNOWN.has(name)) {
      unknown.add(name)
    }
  }
  return [...unknown]
}

/** The text with the shop's details in place; a detail the shop has not given leaves nothing. */
export function fillShopText(text: string, values: ShopInfoValues): string {
  return text
    .normalize("NFC")
    .replace(TOKEN, (whole, name: string) =>
      KNOWN.has(name) ? (values[name as ShopInfoToken] ?? "").replace(INVISIBLE, "").trim() : whole
    )
}

/**
 * The text with the shop's details in place, or null when one it names is
 * not given: a short line that reads only whole (the header's strip note,
 * "{ücretsiz_kargo_eşiği} üzeri kargo bedava") is not shown as half a sentence.
 */
export function fillShopTextWhole(text: string, values: ShopInfoValues): string | null {
  for (const [, name = ""] of text.normalize("NFC").matchAll(TOKEN)) {
    if (KNOWN.has(name) && !(values[name as ShopInfoToken] ?? "").replace(INVISIBLE, "").trim()) {
      return null
    }
  }
  return fillShopText(text, values)
}

function fillBlocks(blocks: readonly Block[], values: ShopInfoValues): Block[] {
  return blocks.map((block) => {
    const content = (block as { content?: unknown }).content
    if (!Array.isArray(content)) {
      return block
    }
    const filled = (content as (Inline | Block)[]).map((node) =>
      node.type === "text"
        ? { ...node, text: fillShopText(node.text, values) }
        : node.type === "hardBreak"
          ? node
          : fillBlocks([node], values)[0]
    )
    return { ...block, content: filled } as Block
  })
}

/** The document with the shop's details in place; its structure kept, so the renderer still decides every tag. */
export function fillShopDoc(doc: ContentDoc, values: ShopInfoValues): ContentDoc {
  return { type: "doc", content: fillBlocks(doc.content, values) }
}

function* textsOf(blocks: readonly (Block | Inline)[]): Generator<string> {
  for (const node of blocks) {
    if (node.type === "text") {
      yield node.text
    }
    const content = (node as { content?: unknown }).content
    if (Array.isArray(content)) {
      yield* textsOf(content as (Block | Inline)[])
    }
  }
}

/** The unknown `{name}`s anywhere in a document's text. */
export function unknownDocTokens(doc: ContentDoc): string[] {
  const unknown = new Set<string>()
  for (const text of textsOf(doc.content)) {
    unknownShopTokens(text).forEach((name) => unknown.add(name))
  }
  return [...unknown]
}
