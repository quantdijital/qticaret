import type { AttributeTemplate, ProductAttributes } from "@/features/attributes/types"
import type {
  PriceDisplayView,
  PriceHistory,
  VariantPriceHistory,
} from "@/features/products/api/price-history"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import type { Assessment, SeoIssue } from "@/features/seo/api/advisor"

/** A product and what the server answers for its page, for the product page's specs. */
export const PRODUCT = {
  id: "prod_1",
  title: "Yatağan Çakı",
  handle: "yatagan-caki",
  description: "El yapımı çakı.",
  subtitle: null,
  updated_at: "2026-11-05T09:00:00Z",
  weight: 450,
  length: 30,
  width: null,
  height: 5,
  categories: [{ id: "pcat_1", name: "Çakılar" }],
  type: null,
  brand: { id: "brand_1", name: "My L'arte" },
  variants: [{ id: "variant_1", title: "Sarı", prices: [{ amount: 3100, currency_code: "try" }] }],
  images: [{ id: "img_1", url: "https://cdn.example/1.jpg", rank: 0 }],
} as unknown as ProductDetail

export const CATALOG: ProductCatalog = {
  condition: "new",
  kind: "physical",
  primary_category_id: "pcat_1",
  withdrawal_excluded: true,
  restriction: null,
  is_gift_card: false,
  addons: [],
  description_doc: null,
  summary_doc: null,
  successor: null,
  categories: [{ id: "pcat_1", name: "Çakılar" }],
  variants: [],
}

export const definition = (key: string, label: string, required = false) => ({
  id: `def_${key}`,
  key,
  label,
  type: "text" as const,
  unit: null,
  options: null,
  rank: 0,
  is_required: required,
  is_filterable: false,
  is_seo_highlight: false,
  scope: "product" as const,
  option_title: null,
  varies_by: null,
})

export const TEMPLATE: AttributeTemplate = {
  id: "tmpl_1",
  name: "Bıçak",
  handle: "bicak",
  description: null,
  definitions: [definition("steel", "Çelik"), definition("length", "Uzunluk", true)],
}

// Today's price, a sale struck through in the storefront
export const SALE: PriceDisplayView = {
  current: "2325.00",
  regular: "3100.00",
  before: "3100.00",
  lowest_before: "3100.00",
  on_sale: true,
  since: null,
  basis: "regular",
}

export const SARI: VariantPriceHistory = {
  id: "variant_1",
  title: "Sarı",
  sku: "MYL-1",
  points: [],
  display: SALE,
}

export const HISTORY: PriceHistory = {
  currency_code: "try",
  rule_version: "2025",
  window_days: 10,
  window_start: "2026-08-07T00:00:00Z",
  variants: [SARI],
}

export const issue = (severity: SeoIssue["severity"], action: string): SeoIssue => ({
  ruleId: "P-TEST-01",
  severity,
  category: "structured",
  params: {},
  fix: { kind: "manual", action },
})

export interface Answers {
  catalog?: ProductCatalog
  attributes?: ProductAttributes
  issues?: SeoIssue[]
  history?: PriceHistory
  features?: { key: string; enabled: boolean }[]
}

export function answer(
  url: string,
  { catalog, attributes, issues, history, features }: Answers
): unknown {
  if (url.endsWith("/catalog")) {
    return catalog ?? CATALOG
  }
  if (url.endsWith("/attributes")) {
    return attributes ?? { template: TEMPLATE, values: { steel: "N690", length: "18,5" } }
  }
  if (url === "/admin/attribute-templates") {
    return { attribute_templates: [TEMPLATE], count: 1 }
  }
  if (url.startsWith("/admin/seo/assessments/")) {
    const assessment: Assessment = {
      score: 80,
      grade: "good",
      issues: issues ?? [],
      categories: {},
      weights: { structured: 0, meta: 0, images: 0, content: 0, links: 0, technical: 0 },
    }
    return { assessment }
  }
  if (url.startsWith("/admin/seo/")) {
    return {
      seo: {
        seo_title: "Yatağan Çakı | Mağaza",
        seo_description: null,
        focus_keyword: null,
        canonical_override: null,
        robots_override: null,
      },
    }
  }
  if (url.startsWith("/admin/platform-settings/")) {
    return {
      values: {
        url_style: { product: "nested" },
        title_templates: {},
        description_templates: {},
        canonical_host: null,
        weight_unit: "g",
        dimension_unit: "cm",
      },
    }
  }
  if (url === "/admin/vat-rates") {
    return { default: { id: "vat_1", code: null, name: "KDV", rate: 20 }, rates: [] }
  }
  if (url.endsWith("/price-history")) {
    return history ?? HISTORY
  }
  // adr/0086: no sale price on any variant
  if (url.endsWith("/sale-prices")) {
    return { currency_code: "try", variants: [] }
  }
  if (url === "/admin/staff/me") {
    return { can: { catalog: true } }
  }
  if (url === "/admin/features") {
    return { features: features ?? [] }
  }
  // The SEO card's AI buttons: no task offered here
  if (url === "/admin/ai/services") {
    return { services: [], tasks: [], flags: { own_keys: true } }
  }
  return {}
}
