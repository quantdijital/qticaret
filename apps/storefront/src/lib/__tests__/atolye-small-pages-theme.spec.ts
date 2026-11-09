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
