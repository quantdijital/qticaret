import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AttributeTemplate, ProductAttributes } from "@/features/attributes/types"
import type {
  PriceDisplayView,
  PriceHistory,
  VariantPriceHistory,
} from "@/features/products/api/price-history"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import type { Assessment, SeoIssue } from "@/features/seo/api/advisor"
import { ProductSections } from "./product-sections"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: unknown) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: {
      productCategory: {
        list: () =>
          Promise.resolve({
            product_categories: [
              { id: "pcat_1", name: "Çakılar", handle: "cakilar", parent_category_id: null },
            ],
          }),
      },
    },
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// Links as plain anchors: the sections are rendered without a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

const PRODUCT = {
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

const CATALOG: ProductCatalog = {
  condition: "new",
  kind: "physical",
  primary_category_id: "pcat_1",
  withdrawal_excluded: true,
  restriction: null,
  is_gift_card: false,
  addons: [],
  description_doc: null,
  successor: null,
  categories: [{ id: "pcat_1", name: "Çakılar" }],
  variants: [],
}

const definition = (key: string, label: string, required = false) => ({
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

const TEMPLATE: AttributeTemplate = {
  id: "tmpl_1",
  name: "Bıçak",
  handle: "bicak",
  description: null,
  definitions: [definition("steel", "Çelik"), definition("length", "Uzunluk", true)],
}

// Today's price, a sale struck through in the storefront
const SALE: PriceDisplayView = {
  current: "2325.00",
  regular: "3100.00",
  before: "3100.00",
  lowest_before: "3100.00",
  on_sale: true,
  since: null,
  basis: "regular",
}

const SARI: VariantPriceHistory = {
  id: "variant_1",
  title: "Sarı",
  sku: "MYL-1",
  points: [],
  display: SALE,
}

const HISTORY: PriceHistory = {
  currency_code: "try",
  rule_version: "2025",
  window_days: 10,
  window_start: "2026-08-07T00:00:00Z",
  variants: [SARI],
}

const issue = (severity: SeoIssue["severity"], action: string): SeoIssue => ({
  ruleId: "P-TEST-01",
  severity,
  category: "structured",
  params: {},
  fix: { kind: "manual", action },
})

interface Answers {
  catalog?: ProductCatalog
  attributes?: ProductAttributes
  issues?: SeoIssue[]
  history?: PriceHistory
  features?: { key: string; enabled: boolean }[]
  drafts?: unknown
}

function answer(
  url: string,
  { catalog, attributes, issues, history, features, drafts }: Answers
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
  if (url === "/admin/staff/me") {
    return { can: { catalog: true } }
  }
  if (url === "/admin/content-drafts") {
    return (
      drafts ?? { enabled: false, provider_ready: false, quota: { used: 0, limit: 0 }, drafts: [] }
    )
  }
  if (url === "/admin/features") {
    return { features: features ?? [] }
  }
  return {}
}

function renderSections(answers: Answers = {}, product: ProductDetail = PRODUCT) {
  fetchMock.mockImplementation((url: string) => Promise.resolve(answer(url, answers)))
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProductSections product={product} />
    </QueryClientProvider>
  )
}

const part = (name: string) => screen.getByRole("button", { name })

/** The owner, 2026-11-05: the product page folds what is not edited every day, as the content editor does. */
describe("ProductSections", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    localStorage.clear()
  })

  it("folds each part to a line that says what is in it, in the page's order", async () => {
    renderSections({ issues: [issue("low", "edit_dimensions")] })
    // Each line once its part has loaded (a skeleton until then)
    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { expanded: false }).map((button) => button.textContent)
      ).toEqual([
        "Arama motoru görünümü",
        "Özellikler",
        "Kategori, marka ve KDV",
        "Paket ölçüleri",
        "Katalog bilgileri",
        "Fiyat geçmişi",
      ])
    })
    await waitFor(() => {
      expect(part("Fiyat geçmişi")).toHaveAccessibleDescription("İndirim üstü çizili gösteriliyor")
    })
    expect(part("Arama motoru görünümü")).toHaveAccessibleDescription(
      "Başlık 21/60 · Açıklama (otomatik) 15/155"
    )
    expect(part("Özellikler")).toHaveAccessibleDescription("Bıçak şablonu · 2/2 alan dolu")
    expect(part("Kategori, marka ve KDV")).toHaveAccessibleDescription(
      "Çakılar · My L'arte · KDV (%20)"
    )
    // The advisor's finding for the parcel is counted after it
    expect(part("Paket ölçüleri")).toHaveAccessibleDescription("450 g · 30 × — × 5 cm · 1 öneri")
    expect(part("Katalog bilgileri")).toHaveAccessibleDescription(
      "Yeni · Ana kategori: Çakılar · Cayma hakkı dışında"
    )
  })

  it("opens a part the advisor has an urgent finding for, and one with a required field empty", async () => {
    renderSections({
      issues: [issue("high", "edit_categories")],
      attributes: { template: TEMPLATE, values: { steel: "N690" } },
    })
    await waitFor(() => {
      expect(part("Kategori, marka ve KDV")).toHaveAttribute("aria-expanded", "true")
    })
    await waitFor(() => {
      expect(part("Özellikler")).toHaveAttribute("aria-expanded", "true")
    })
    expect(part("Arama motoru görünümü")).toHaveAttribute("aria-expanded", "false")
    // Open, the facts button is in its header
    expect(
      screen.getByRole("button", { name: "Açıklamadaki özellikleri aktar" })
    ).toBeInTheDocument()
  })

  it("says a parcel left empty is priced by the default one, and has none for a digital product", async () => {
    const user = userEvent.setup()
    const bare = { ...PRODUCT, weight: null, length: null, height: null } as ProductDetail
    const first = renderSections({}, bare)
    await waitFor(() => {
      expect(part("Paket ölçüleri")).toHaveAccessibleDescription(
        "Girilmedi; varsayılan paket kullanılır"
      )
    })
    // Remembered per person: opened once, it opens the next time too
    await user.click(part("Paket ölçüleri"))
    expect(localStorage.getItem("qt.panel.section:anyone:product.shipping")).toBe("1")

    first.unmount()
    renderSections({ catalog: { ...CATALOG, kind: "digital" } }, bare)
    await waitFor(() => {
      expect(part("Katalog bilgileri")).toHaveAccessibleDescription(
        "Dijital ürün · Yeni · Ana kategori: Çakılar · Cayma hakkı dışında"
      )
    })
    expect(screen.queryByRole("button", { name: "Paket ölçüleri" })).not.toBeInTheDocument()
  })

  it("adds the parts the shop uses: variant pictures, add-ons and drafts, each with its line", async () => {
    // The other variant's discount is not shown: its price was lower in the days before
    const unsold = { ...SALE, on_sale: false, before: null }
    renderSections(
      {
        catalog: {
          ...CATALOG,
          addons: [
            {
              id: "addon_1",
              label: "İsim yazdırma",
              help: null,
              required: false,
              max_quantity: null,
              non_withdrawable: true,
              kind: "text",
              price: 35,
              text: { max_length: 20, charset: "text" },
            },
          ],
        },
        features: [{ key: "catalog.addons", enabled: true }],
        drafts: {
          enabled: true,
          provider_ready: true,
          quota: { used: 3, limit: 20 },
          drafts: [
            { id: "d_1", kind: "seo_title", text: "Yatağan Çakı", status: "draft", problems: null },
          ],
        },
        history: {
          ...HISTORY,
          variants: [SARI, { ...SARI, id: "variant_2", title: "Mor", display: unsold }],
        },
      },
      {
        ...PRODUCT,
        variants: [...(PRODUCT.variants ?? []), { id: "variant_2", title: "Mor", prices: [] }],
        images: [
          {
            id: "img_1",
            url: "https://cdn.example/1.jpg",
            rank: 0,
            variants: [{ id: "variant_2" }],
          },
          { id: "img_2", url: "https://cdn.example/2.jpg", rank: 1 },
        ],
      } as unknown as ProductDetail
    )
    await waitFor(() => {
      expect(part("İçerik taslakları")).toHaveAccessibleDescription(
        "1 taslak onay bekliyor · Bu ay 3/20 taslak"
      )
    })
    expect(part("Varyant görselleri")).toHaveAccessibleDescription(
      "1/2 görsel belirli varyantlara bağlı"
    )
    await waitFor(() => {
      expect(part("Ek seçenekler")).toHaveAccessibleDescription("1 ek seçenek · İsim yazdırma")
    })
    await waitFor(() => {
      expect(part("Fiyat geçmişi")).toHaveAccessibleDescription(
        "1 varyantta indirim üstü çizili gösteriliyor · 1 varyantta indirim üstü çizili gösterilmiyor"
      )
    })
  })
})
