import type { ProductFacts } from "../ai/facts/product"
import type { AiFieldRule } from "../ai/field-rules"
import { cleanText } from "../ai/prompt"

/**
 * adr/0005's draft prompts, kept only for its draft routes until docs/22
 * PR 2-2 removes them (the AI core asks with `lib/ai/instructions.ts` and
 * `lib/ai/prompt.ts`). The facts come from the core's product reader and
 * every value goes through the core's personal data filter: nothing here
 * filters or reads on its own.
 */

export const DRAFT_KINDS = [
  "product_description",
  "seo_title",
  "seo_description",
] as const satisfies readonly AiFieldRule[]
export type DraftKind = (typeof DRAFT_KINDS)[number]

/** What a product draft may know of the product: nothing of anyone. */
export interface ProductDraftFacts extends ProductFacts {
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

const cleanOrNull = (text: string | null, max: number) => (text ? cleanText(text, max) : null)

/**
 * The facts as they may leave the shop: every value and label filtered of
 * personal data, then clipped. What a provider gets, beside the prompt
 * made of them (security review 2026-10-29).
 */
export function draftFacts(facts: ProductDraftFacts): ProductDraftFacts {
  return {
    name: cleanText(facts.name, 300),
    subtitle: cleanOrNull(facts.subtitle, 300),
    brand: cleanOrNull(facts.brand, 300),
    category: cleanOrNull(facts.category, 300),
    attributes: facts.attributes
      .slice(0, 30)
      .map((each) => ({ label: cleanText(each.label, 100), value: cleanText(each.value, 300) })),
    description: cleanOrNull(facts.description, 2000),
    shopName: cleanText(facts.shopName, 300),
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
