/** A template filled with sample values, for previews (no SDK, tested on its own). */

// What a template's preview fills each token with (docs/13 §3)
const SAMPLE: Record<string, string> = {
  ürün_adı: "Keten Gömlek",
  marka: "Örnek Marka",
  kategori: "Giyim",
  öne_çıkan_attribute: "%100 keten",
  kısa_açıklama: "Yıkanmış ketenden rahat kesim gömlek",
  fiyat_cümlesi: "899,00 TL.",
  kargo_cümlesi: "Aynı gün kargoda.",
}

export function renderSample(template: string, storeName: string): string {
  return template
    .replace(/\{([^{}]*)\}/gu, (_, token: string) =>
      token === "mağaza" ? storeName : (SAMPLE[token] ?? "")
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
