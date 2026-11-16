import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { AddonFieldView, AddonFormView, CartLineView, CookieBannerView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { renderPage } from "@/test/theme-render"
// A cart line's picks editor is a part of the cart page, rendered on its own
import { AddonEditor } from "../../../../../packages/themes/atolye/src/cart/AddonEditor"

/**
 * The pages and parts Atölye drew last (2026-11-09, adr/0057 Ek: until then
 * the base theme's): the brands' index, a link's confirmation, the cookie
 * preferences page, a gift card's balance and a cart line's picks editor.
 * Plain links and forms, the storefront's field names, no inline style.
 */

const nothing = () => Promise.resolve()

/** A form field's tag, found by its name, whatever the order of its attributes. */
const tag = (html: string, name: string) =>
  new RegExp(`<(?:input|textarea|select)[^>]*name="${name}"[^>]*>`).exec(html)?.[0] ?? ""

describe("the brands' index", () => {
  const view = {
    title: "Markalar",
    breadcrumbs: [
      { label: "Ana sayfa", path: "/" },
      { label: "Markalar", path: null },
    ],
    groups: [
      {
        letter: "Ç",
        anchor: "harf-c",
        brands: [{ label: "Çelik Usta", path: "/marka/celik-usta", logo: null }],
      },
      {
        letter: "K",
        anchor: "harf-k",
        brands: [{ label: "Kızılcık", path: "/marka/kizilcik", logo: null }],
      },
    ],
  }

  it("leads by letter to each letter's brands, every brand one link", () => {
    const html = renderPage(atolyeTheme, "BrandsPage", { view })
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain(`aria-label="${t("brands.letters")}"`)
    expect(html).toContain('href="#harf-c"')
    expect(html).toMatch(/<h2 id="harf-k"[^>]*>K<\/h2>/)
    expect(html).toContain('href="/marka/celik-usta"')
    expect(html).toContain('aria-current="page"')
    expect(html).not.toContain("style=")
  })

  // A tile without a logo as the page drew it before logos widened (adr/0066: unchanged)
  const TILE =
    '<a href="/marka/celik-usta" class="flex min-h-16 min-w-0 items-center gap-3 rounded-media gf-pane p-3 transition-colors duration-(--dur-micro) hover:bg-paper-3"><span class="min-w-0 text-md font-semibold break-words">Çelik Usta</span></a>'

  it("draws a brand without a logo as its name, as before", () => {
    const html = renderPage(atolyeTheme, "BrandsPage", { view })
    expect(html).toContain(TILE)
  })

  it("gives a logo a plate 40 px tall and as wide as its ratio, up to 120 px, the name's line first", () => {
    const withLogo = {
      ...view,
      groups: [
        ...view.groups.slice(0, 1),
        {
          letter: "K",
          anchor: "harf-k",
          brands: [
            {
              label: "Kızılcık",
              path: "/marka/kizilcik",
              logo: {
                src: "https://cdn.example/kizilcik.png",
                alt: "",
                width: null,
                height: null,
                sources: { avif: null, webp: null },
              },
            },
          ],
        },
      ],
    }
    const html = renderPage(atolyeTheme, "BrandsPage", { view: withLogo })
    const tile = /<a href="\/marka\/kizilcik"[^>]*>(.*?)<\/a>/.exec(html)?.[1] ?? ""
    // A fixed height, the width the logo's own from the square (a square logo's plate, as before) to 120 px
    expect(tile).toContain(
      'class="gf-logo-plate flex h-10 max-w-30 min-w-10 items-center justify-center overflow-hidden rounded-inner bg-field"'
    )
    expect(tile).toMatch(/<img[^>]*class="max-h-10 max-w-full object-contain"/)
    expect(tile).toContain('src="https://cdn.example/kizilcik.png"')
    // The name keeps its line and leaves the square's room: the plate gives way first
    expect(tile).toContain(
      '<span class="max-w-[calc(100%-3.25rem)] min-w-0 shrink-0 text-md font-semibold break-words">Kızılcık</span>'
    )
    // The brand without one is untouched beside it
    expect(html).toContain(TILE)
    // No size known: the plate takes the logo's width once it loads, as before
    expect(tile).not.toMatch(/<img[^>]* (width|height)=/)
  })

  it("sizes a logo's plate before its file arrives when the server read its size", () => {
    const tileOf = (width: number, height: number) => {
      const logo = { src: "https://cdn.example/l.png", alt: "", width, height }
      const brands = [
        {
          label: "Kızılcık",
          path: "/marka/k",
          logo: { ...logo, sources: { avif: null, webp: null } },
        },
      ]
      const html = renderPage(atolyeTheme, "BrandsPage", {
        view: { ...view, groups: [{ letter: "K", anchor: "harf-k", brands }] },
      })
      expect(html).not.toContain("style=")
      return /<a href="\/marka\/k"[^>]*>(.*?)<\/a>/.exec(html)?.[1] ?? ""
    }
    const plate = (tile: string) =>
      /<span class="gf-logo-plate ([^"]*)"/.exec(tile)?.[1]?.split(" ")
    // 3:1 whole at 120 px, 6:1 kept at 120 px (lower), a square at the square, a small one its own
    for (const [width, height, step] of [
      [600, 200, "w-30"],
      [600, 100, "w-30"],
      [400, 400, "w-10"],
      [500, 300, "w-17"],
      [60, 20, "w-15"],
    ] as const) {
      const tile = tileOf(width, height)
      expect(plate(tile)).toEqual(
        expect.arrayContaining(["h-10", "max-w-30", "min-w-10", "overflow-hidden", step])
      )
      expect(tile).toMatch(new RegExp(`<img[^>]*width="${String(width)}"`))
      expect(tile).toMatch(new RegExp(`<img[^>]*height="${String(height)}"`))
      expect(tile).toMatch(/<img[^>]*class="max-h-10 max-w-full object-contain"/)
    }
  })

  it("says so when the shop has no brand", () => {
    const html = renderPage(atolyeTheme, "BrandsPage", { view: { ...view, groups: [] } })
    expect(html).toContain(t("brands.empty"))
    expect(html).not.toContain(t("brands.letters"))
  })
})

describe("a link's confirmation", () => {
  const view = {
    title: "E-bülten aboneliği",
    text: "Aboneliğinizi bitirmek istediğinize emin misiniz?",
    warning: null,
    fields: [{ name: "token", value: "abc" }],
    submit: "Aboneliği bitir",
    back: { label: "Ana sayfaya dön", path: "/" },
  }

  it("asks with one button, the link's fields hidden in its form, and the way back", () => {
    const html = renderPage(atolyeTheme, "ConfirmPage", { view, action: nothing })
    expect(html).toContain('<input type="hidden" name="token" value="abc"/>')
    expect(html).toMatch(/<button type="submit" class="gf-btn">Aboneliği bitir<\/button>/)
    expect(html).toContain('href="/"')
  })

  it("leaves only the words and the way back with nothing to do", () => {
    const html = renderPage(atolyeTheme, "ConfirmPage", {
      view: { ...view, submit: null, warning: "Bağlantının süresi dolmuş." },
      action: nothing,
    })
    expect(html).not.toContain("<form")
    expect(html).toContain('role="note"')
    expect(html).toContain("Ana sayfaya dön")
  })
})

describe("the cookie preferences page", () => {
  const banner: CookieBannerView = {
    policyVersion: 3,
    policyPath: "/yasal/cerez-politikasi",
    due: false,
    analytics: true,
    marketing: false,
  }

  it("is one plain form back to itself, the answer in force ticked, three equal buttons", () => {
    const html = renderPage(atolyeTheme, "CookiePreferencesPage", {
      view: { title: "Çerez tercihleri", banner, notice: "Tercihiniz kaydedildi." },
      save: nothing,
    })
    expect(html).toContain('name="policy_version" value="3"')
    expect(html).toContain('name="return" value="preferences"')
    expect(tag(html, "analytics")).toContain('checked=""')
    expect(tag(html, "marketing")).not.toContain("checked")
    expect(html).toContain('href="/yasal/cerez-politikasi"')
    expect(html).toContain('role="status"')
    for (const choice of ["custom", "necessary", "all"]) {
      const button = new RegExp(`<button[^>]*value="${choice}"[^>]*>`).exec(html)?.[0] ?? ""
      expect(button).toContain('name="choice"')
      expect(button).toContain('class="gf-btn gf-btn--quiet"')
    }
  })
})

describe("a gift card's balance", () => {
  it("asks for the code in the body of a post, never the address", () => {
    const html = renderPage(atolyeTheme, "GiftCardBalancePage", {
      view: { title: "Hediye kartı bakiyesi", text: "Kodu yazın.", breadcrumbs: [] },
      actions: {
        checkBalance: () =>
          Promise.resolve({ ok: false, error: null, challenge: null, balance: null }),
      },
    })
    expect(html).toMatch(/<form [^>]*method="post"/)
    expect(html).toMatch(/<input id="hediye-karti-kodu"[^>]*name="code"/)
    expect(html).toContain(`placeholder="${t("placeholder.gift_card_code")}"`)
    expect(html).toContain('role="status"')
  })
})

describe("a cart line's picks editor", () => {
  const field: AddonFieldView = {
    id: "yazi",
    kind: "text",
    label: "Ürün üzerine yazı",
    help: null,
    required: false,
    maxQuantity: null,
    nonWithdrawable: true,
    price: "+35,00 TL",
    kurus: 3500,
    maxLength: 20,
    rules: null,
    choices: [],
  }
  const form = (over: Partial<AddonFormView> = {}): AddonFormView => ({
    productId: "prod_1",
    fields: [field],
    values: { yazi: "Ahmet" },
    missingRequired: false,
    removable: true,
    ...over,
  })
  const render = (addonForm: AddonFormView) =>
    renderToStaticMarkup(
      createElement(AddonEditor, {
        line: { id: "line_1", addons: [{ label: "Yazı", value: "Ahmet" }] } as CartLineView,
        form: addonForm,
        save: nothing,
        t,
      })
    )

  it("starts the line's own fields as picked, closed, with a way to take them off", () => {
    const html = render(form())
    expect(tag(html, "addon_yazi")).toMatch(/id="ek-line_1-yazi".*value="Ahmet"/)
    expect(html).toContain('name="line_id" value="line_1"')
    expect(html).toContain('name="product_id" value="prod_1"')
    expect(html).not.toMatch(/<details[^>]*open/)
    expect(html).toContain('name="clear" value="1"')
    expect(html).toContain(t("addons.non_withdrawable"))
  })

  it("opens by itself while a required pick is missing, offering no removal", () => {
    const html = render(form({ missingRequired: true, removable: false, values: {} }))
    expect(html).toMatch(/<details[^>]*open=""/)
    expect(html).toContain(t("addons.missing_required"))
    expect(html).not.toContain('name="clear"')
  })
})
