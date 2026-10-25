/** A template filled with sample values, for previews (no SDK, tested on its own). */

/** Fills tokens with `samples` (i18n `settings.seo.samples`), the shop's name for {mağaza}. */
export function renderSample(
  template: string,
  storeName: string,
  samples: Readonly<Record<string, string>>
): string {
  return template
    .replace(/\{([^{}]*)\}/gu, (_, token: string) =>
      token === "mağaza" ? storeName : (samples[token] ?? "")
    )
    .replace(/\s+/g, " ")
    .trim()
}

/** Tokens each template may use, as the server checks them (lib/seo/template). */
export const TEMPLATE_TOKENS = {
  product: [
    "ürün_adı",
    "marka",
    "mağaza",
    "kategori",
    "öne_çıkan_attribute",
    "kısa_açıklama",
    "fiyat_cümlesi",
    "kargo_cümlesi",
  ],
  category: ["kategori", "mağaza"],
  brand: ["marka", "mağaza"],
} as const
