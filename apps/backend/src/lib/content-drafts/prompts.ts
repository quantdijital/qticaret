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

/** The prompt for a draft: the ask, then the product's facts, filtered. */
export function draftPrompt(kind: DraftKind, facts: ProductDraftFacts): string {
  const line = (label: string, value: string | null) =>
    value ? `${label}: ${redactPersonalData(clip(value.trim(), 300))}` : null
  return [
    ASKS[kind],
    "",
    "Ürün bilgileri:",
    line("Ad", facts.name),
    line("Alt başlık", facts.subtitle),
    line("Marka", facts.brand),
    line("Kategori", facts.category),
    line("Mağaza", facts.shopName),
    ...facts.attributes.slice(0, 30).map((each) => line(each.label, each.value)),
    facts.description
      ? `Mevcut açıklama: ${redactPersonalData(clip(facts.description.trim(), 2000))}`
      : null,
  ]
    .filter((each): each is string => each !== null)
    .join("\n")
}
