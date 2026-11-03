import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { baseTheme } from "@qticaret/theme-base"
import type {
  AuthActions,
  AuthPageView,
  HomeSectionView,
  ImageView,
  ProductPageView,
  ThemeActions,
} from "@qticaret/ui"
import { t } from "@/lib/i18n"

/**
 * What scrolls in the base theme with nothing in it to focus takes the
 * focus itself, labelled, so a keyboard reaches and scrolls it (WCAG 2.1.1,
 * axe scrollable-region-focusable at 390 px); where something in it is
 * focusable already, that is the only stop.
 */

const refused = () => Promise.resolve({ ok: false, error: null, challenge: null })
const nothing = () => Promise.resolve()
const actions: ThemeActions = {
  addToCart: refused,
  changeCartLine: nothing,
  applyPromotion: refused,
  removePromotion: nothing,
  writeReview: refused,
  askQuestion: refused,
  stockAlert: refused,
  addFavorite: refused,
  installments: () => Promise.resolve(null),
}

const image = (n: number): ImageView => ({
  src: `/media/gorsel-${String(n)}.jpg`,
  alt: `Görsel ${String(n)}`,
  width: 800,
  height: 800,
  sources: { avif: null, webp: null },
})

const product = (images: ImageView[]): ProductPageView => ({
  id: "prod_1",
  title: "Keten Gömlek",
  subtitle: null,
  description: [],
  descriptionHtml: null,
  brand: null,
  breadcrumbs: [],
  images,
  options: [],
  variants: [],
  selectedVariantId: null,
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

const productPage = (images: ImageView[]) =>
  renderToStaticMarkup(createElement(baseTheme.ProductPage, { t, view: product(images), actions }))

// An element's opening tag, found by its label
const openingTag = (html: string, label: string) =>
  new RegExp(`<[a-z]+ [^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0] ?? null

describe("the base theme's product gallery", () => {
  it("is a labelled row the keyboard reaches and scrolls, its pictures a list inside it", () => {
    const html = productPage([image(1), image(2), image(3)])
    const row = openingTag(html, "Ürün görselleri")
    expect(row).toMatch(/^<section /)
    expect(row).toContain('tabindex="0"')
    // The focusable element is the one that scrolls
    expect(row).toContain("overflow-x-auto")
    const start = html.indexOf(row ?? "")
    const gallery = html.slice(start, html.indexOf("</section>", start))
    expect(gallery.slice((row ?? "").length)).toMatch(/^<ul /)
    expect(gallery.match(/<li /g)).toHaveLength(3)
    // One stop: nothing inside takes the focus too
    expect(gallery.match(/tabindex=/g)).toHaveLength(1)
    expect(gallery).not.toMatch(/<(a|button|input) /)
  })

  it("is no stop with one picture, which never scrolls", () => {
    const row = openingTag(productPage([image(1)]), "Ürün görselleri")
    expect(row).not.toBeNull()
    expect(row).not.toContain("tabindex")
  })
})

const banner = (links: boolean): HomeSectionView => ({
  id: "afis",
  type: "banner",
  slides: [1, 2, 3].map((n) => ({
    image: image(n),
    heading: `Afiş ${String(n)}`,
    text: null,
    link: links ? { label: `Afiş ${String(n)}`, path: `/afis-${String(n)}` } : null,
  })),
})

const homePage = (section: HomeSectionView) =>
  renderToStaticMarkup(createElement(baseTheme.HomePage, { t, view: { sections: [section] } }))

describe("the base theme's banner row", () => {
  it("takes the focus itself, labelled, when no slide links anywhere", () => {
    const row = openingTag(homePage(banner(false)), "Öne çıkanlar")
    expect(row).toContain('tabindex="0"')
    expect(row).toContain("overflow-x-auto")
  })

  it("leaves the stops to its slides' links when they have them", () => {
    const html = homePage(banner(true))
    expect(openingTag(html, "Öne çıkanlar")).not.toContain("tabindex")
    expect(html).toContain('href="/afis-1"')
  })
})

const refusedAuth = () => Promise.resolve({ ok: false, error: null, challenge: null })
const authActions: AuthActions = {
  login: refusedAuth,
  register: refusedAuth,
  forgot: refusedAuth,
  reset: refusedAuth,
  verify: refusedAuth,
  lookup: refusedAuth,
}

describe("the base theme's membership text on the register page", () => {
  it("scrolls in a labelled box the keyboard reaches", () => {
    const view: AuthPageView = {
      mode: "register",
      notice: null,
      email: null,
      token: null,
      needsPassword: false,
      terms: { kind: "membership", version: 1, title: "Üyelik sözleşmesi", html: "<p>Madde 1</p>" },
      next: null,
      invite: null,
      links: { login: "/hesap/giris", register: "/hesap/kayit", forgot: "/hesap/sifre-sifirla" },
    }
    const html = renderToStaticMarkup(
      createElement(baseTheme.AuthPage, { t, view, actions: authActions })
    )
    const box = openingTag(html, "Üyelik sözleşmesi")
    expect(box).toContain('role="region"')
    expect(box).toContain('tabindex="0"')
    expect(box).toContain("overflow-y-auto")
  })
})
