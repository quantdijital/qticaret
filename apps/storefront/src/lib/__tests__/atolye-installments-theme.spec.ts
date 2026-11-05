import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  ActionResult,
  InstallmentFamilyView,
  ProductPageView,
  ThemeActions,
  VariantView,
} from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { renderPage } from "@/test/theme-render"
import { InstallmentPlans } from "../../../../../packages/themes/atolye/src/product/InstallmentPlans"
import { installmentWords } from "../../../../../packages/themes/atolye/src/product/words"

/**
 * The Grafit product page's instalments (owner 2026-11-05: "no long
 * table under add to cart"): one quiet line under the price with a small
 * button that opens the table in a dialog; the table itself, card
 * programs as radio pills over one ruled grid. Words and amounts are the
 * storefront's; nothing is computed here.
 */

const ok = (): Promise<ActionResult> => Promise.resolve({ ok: true, error: null })

const actions: ThemeActions = {
  addToCart: ok,
  changeCartLine: () => Promise.resolve(),
  applyPromotion: ok,
  removePromotion: () => Promise.resolve(),
  writeReview: ok,
  askQuestion: ok,
  stockAlert: () => Promise.resolve({ ok: true, error: null, challenge: null }),
  addFavorite: ok,
  installments: () => Promise.resolve(null),
}

const variant = (over: Partial<VariantView> = {}): VariantView => ({
  id: "variant_kirmizi",
  title: "Kırmızı",
  options: {},
  price: { current: "1.968,75 TL", before: null, from: false, discount: null },
  available: true,
  sku: null,
  installments: { count: 12, perInstallment: "195,87 TL" },
  ...over,
})

const view = (variants: VariantView[]): ProductPageView => ({
  id: "prod_1",
  title: "Sürmene 4'lü Mutfak Bıçağı Seti",
  subtitle: null,
  description: [],
  descriptionHtml: null,
  brand: null,
  breadcrumbs: [{ label: "Ana sayfa", path: "/" }],
  images: [],
  options: [],
  variants,
  selectedVariantId: variants[0]?.id ?? null,
  specs: [],
  trustBadges: [],
  reviews: { average: null, count: 0, items: [] },
  questions: { count: 0, items: [] },
  related: [],
  whatsappHref: null,
  signedIn: false,
  loginPath: "/hesap/giris",
  shippingNote: null,
})

const page = (variants: VariantView[]) =>
  renderPage(atolyeTheme, "ProductPage", { view: view(variants), actions })

describe("the product page's instalment line", () => {
  it("says the most instalments and the lowest monthly amount under the price, the whole line opening the table", () => {
    const html = page([variant()])
    const line =
      /<button[^>]*data-installment-line=""[^>]*>[\s\S]*?<\/button>/.exec(html)?.[0] ?? ""
    expect(line).toContain('aria-haspopup="dialog"')
    expect(line).toContain('type="button"')
    expect(line).toContain(">12 aya varan taksit</span>")
    expect(line).toContain(">aylık 195,87 TL&#x27;den</span>")
    expect(line).toMatch(/>Taksit seçenekleri<\/span>/)
    // A narrow column (a phone) says it short, the label for a screen reader, a chevron instead
    expect(line).toMatch(/<span class="[^"]*@min-\[30rem\]:hidden">12 taksit<\/span>/)
    expect(line).toMatch(/<span class="[^"]*@max-\[30rem\]:hidden">12 aya varan taksit<\/span>/)
    expect(line).toMatch(/<span class="[^"]*@max-\[30rem\]:sr-only">Taksit seçenekleri<\/span>/)
    // An amount never breaks from its "TL"
    expect(line).toMatch(/<span class="[^"]*whitespace-nowrap[^"]*">aylık 195,87 TL/)
    // Under the price, above the stock and the buy row; never a long table under "add to cart"
    expect(html.indexOf("1.968,75 TL")).toBeLessThan(html.indexOf("12 aya varan taksit"))
    expect(html.indexOf("12 aya varan taksit")).toBeLessThan(html.indexOf(">Stokta</p>"))
    expect(html.indexOf("12 aya varan taksit")).toBeLessThan(html.indexOf("data-buy-row"))
    expect(html).not.toContain('<details class="group/taksit')
    expect(html).not.toContain("<table")
  })

  it("draws no line and no button when the shop offers none for this price", () => {
    const html = page([variant({ installments: null })])
    expect(html).not.toContain("aya varan taksit")
    expect(html).not.toContain("Taksit seçenekleri")
  })

  it("draws none for a variant out of stock", () => {
    const html = page([variant({ available: false })])
    expect(html).not.toContain("aya varan taksit")
  })
})

const families: InstallmentFamilyView[] = [
  {
    family: "Advantage",
    options: [
      { count: 1, perInstallment: "1.968,75 TL", total: "1.968,75 TL" },
      { count: 12, perInstallment: "197,43 TL", total: "2.369,22 TL" },
    ],
  },
  {
    family: "World",
    options: [
      { count: 1, perInstallment: "1.968,75 TL", total: "1.968,75 TL" },
      { count: 3, perInstallment: "656,25 TL", total: "1.968,75 TL", free: true },
      { count: 12, perInstallment: "195,87 TL", total: "2.350,49 TL" },
    ],
  },
]

const plans = (first: string | null) =>
  renderToStaticMarkup(
    createElement(InstallmentPlans, { families, first, words: installmentWords(t) })
  )

describe("the instalment dialog's table", () => {
  it("offers the card programs as one radio group, opening on the program the line quoted", () => {
    const html = plans("World")
    // Named for a screen reader only (owner 2026-11-05: no visible label over the programs)
    expect(html).toContain('<legend class="sr-only">Kart programı</legend>')
    const radios = html.match(/<input[^>]*name="taksit-programi"[^>]*>/g) ?? []
    expect(radios).toHaveLength(2)
    expect(radios.find((radio) => radio.includes('value="World"'))).toContain('checked=""')
    expect(html).toContain('<caption class="sr-only">World</caption>')
  })

  it("lists count, monthly and total, one payment in words, a count at the one-payment price marked", () => {
    const html = plans("World")
    expect(html).toMatch(
      /<th scope="col"[^>]*>Taksit<\/th><th scope="col"[^>]*>Aylık<\/th><th scope="col"[^>]*>Toplam<\/th>/
    )
    expect(html.match(/<tr class="border-t border-rule">/g)).toHaveLength(3)
    expect(html).toContain("Tek çekim")
    expect(html).toMatch(/3<span[^>]*text-ok[^>]*>Peşin fiyatına<\/span>/)
    expect(html.match(/Peşin fiyatına/g)).toHaveLength(1)
    expect(html).toContain(">195,87 TL</td>")
    expect(html).toContain("tabular")
  })

  it("opens on the first program when the line's is not among them", () => {
    const html = plans(null)
    const radios = html.match(/<input[^>]*name="taksit-programi"[^>]*>/g) ?? []
    expect(radios.find((radio) => radio.includes('value="Advantage"'))).toContain('checked=""')
  })
})
