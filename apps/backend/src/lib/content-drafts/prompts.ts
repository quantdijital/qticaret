import { redactPersonalData } from "./redact"

/**
 * The prompts a draft is asked with (adr/0005): sector-neutral, fed from
 * the product's own fields and attribute template, never from orders or
 * customers. Every value goes through the personal data filter first.
 */

export const DRAFT_KINDS = ["product_description", "seo_title", "seo_description"] as const
export type DraftKind = (typeof DRAFT_KINDS)[number]

/** What a product draft may know of the product: nothing of anyone. */
export interface ProductDraftFacts {
  name: string
  subtitle: string | null
  brand: string | null
  category: string | null
  /** The product's attributes as its template names them: "Malzeme: Keten". */
  attributes: { label: string; value: string }[]
  /** Its description now, as plain text; a draft may improve on it. */
  description: string | null
  shopName: string
}

const ASKS: Record<DraftKind, string> = {
  product_description:
    "Bu ürün için Türkçe, en az 200 kelimelik, özgün bir ürün açıklaması yaz. Ürünün özelliklerini ve kullanımını anlat; abartılı ve doğrulanamayan iddialardan kaçın. Yalnızca açıklama metnini ver.",
  seo_title:
    "Bu ürün sayfası için Türkçe bir arama sonucu başlığı yaz: 30–60 karakter, ürün adıyla başlasın, büyük harfle bağırmasın. Yalnızca başlığı ver.",
  seo_description:
    "Bu ürün sayfası için Türkçe bir arama sonucu açıklaması yaz: 70–155 karakter, ürünün öne çıkan özelliğini söylesin. Yalnızca açıklamayı ver.",
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text)

// Filtered whole, then clipped: a number cut at the edge cannot slip half through
const clean = (text: string, max: number) => clip(redactPersonalData(text.trim()), max)
const cleanOrNull = (text: string | null, max: number) => (text ? clean(text, max) : null)

/**
 * The facts as they may leave the shop: every value and label filtered of
 * personal data, then clipped. What a provider gets, beside the prompt
 * made of them (security review 2026-10-29).
 */
export function draftFacts(facts: ProductDraftFacts): ProductDraftFacts {
  return {
    name: clean(facts.name, 300),
    subtitle: cleanOrNull(facts.subtitle, 300),
    brand: cleanOrNull(facts.brand, 300),
    category: cleanOrNull(facts.category, 300),
    attributes: facts.attributes
      .slice(0, 30)
      .map((each) => ({ label: clean(each.label, 100), value: clean(each.value, 300) })),
    description: cleanOrNull(facts.description, 2000),
    shopName: clean(facts.shopName, 300),
  }
}

/** The prompt for a draft: the ask, then the product's facts, filtered. */
export function draftPrompt(kind: DraftKind, raw: ProductDraftFacts): string {
  const facts = draftFacts(raw)
  const line = (label: string, value: string | null) => (value ? `${label}: ${value}` : null)
  return [
    ASKS[kind],
    "",
    "Ürün bilgileri:",
    line("Ad", facts.name),
    line("Alt başlık", facts.subtitle),
    line("Marka", facts.brand),
    line("Kategori", facts.category),
    line("Mağaza", facts.shopName),
    ...facts.attributes.map((each) => line(each.label, each.value)),
    facts.description ? `Mevcut açıklama: ${facts.description}` : null,
  ]
    .filter((each): each is string => each !== null)
    .join("\n")
}
