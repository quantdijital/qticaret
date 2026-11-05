import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { CheckoutActions, CheckoutPageView, CheckoutSummaryView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The theme's checkout (design.md § Buying pages): three steps as tinted
 * wells with the storefront's field names and handlers kept, the TR
 * address selects, the carriers and ways to pay as rows, the contracts
 * and the age declaration, the basket as a graphite stage (folded on a
 * phone), the framed card form and the result page.
 */

const actions: CheckoutActions = {
  saveAddress: () => Promise.resolve({ ok: true, error: null }),
  chooseShipping: () => Promise.resolve({ ok: true, error: null }),
  placeOrder: () => Promise.resolve({ ok: true, error: null, challenge: null }),
  districts: () => Promise.resolve([]),
  neighborhoods: () => Promise.resolve([]),
}

const summary: CheckoutSummaryView = {
  lines: [
    {
      id: "cali_1",
      title: "Kalem Ucu Çakı",
      detail: "Kiremit",
      quantity: 1,
      total: "314,30 TL",
      image: null,
      addons: [
        { label: "Hediye paketi", value: "Evet", amount: "+50,00 TL", nonWithdrawable: false },
      ],
    },
  ],
  items: "449,00 TL",
  discount: "134,70 TL",
  shipping: null,
  total: "314,30 TL",
}

const view = (over: Partial<CheckoutPageView> = {}): CheckoutPageView => ({
  step: "address",
  address: {
    values: {
      email: "",
      phone: "",
      first_name: "",
      last_name: "",
      province: "",
      district: "",
      neighborhood: "",
      address_1: "",
    },
    provinces: [{ value: "20", label: "Denizli" }],
    districts: [],
    neighborhoods: [],
  },
  addressSummary: null,
  shippingOptions: [],
  shippingSelected: null,
  shippingSummary: null,
  paymentMethods: [],
  contracts: {},
  ageLimit: null,
  marketingVersion: "checkout-1",
  summary,
  error: null,
  editPaths: { address: "/odeme?adim=adres", shipping: "/odeme?adim=kargo", payment: "/odeme" },
  invoice: { text: "Faturanız teslimat adınıza bireysel olarak kesilir.", link: null },
  ...over,
})

const paying = (over: Partial<CheckoutPageView> = {}) =>
  view({
    step: "payment",
    addressSummary: {
      email: "ayse@quantdijital.com",
      name: "Ayşe Yılmaz",
      lines: ["Cumhuriyet Cad. No: 12", "Merkezefendi, Denizli 20010"],
      phone: "0532 123 45 67",
    },
    shippingSummary: "Aras Kargo · 95,00 TL",
    paymentMethods: [
      { id: "pp_paytr_paytr", kind: "card", label: "Kredi / banka kartı", detail: null },
      {
        id: "pp_bank-transfer_bank-transfer",
        kind: "bank_transfer",
        label: "Havale / EFT",
        detail: null,
      },
    ],
    contracts: {
      card: [
        {
          kind: "pre_information",
          version: 3,
          title: "Ön Bilgilendirme Formu",
          html: "<p>Metin</p>",
        },
        {
          kind: "distance_sales",
          version: 2,
          title: "Mesafeli Satış Sözleşmesi",
          html: "<p>Metin</p>",
        },
      ],
    },
    ...over,
  })

describe("the theme's checkout", () => {
  it("keeps the address step's fields, names and one submit button", () => {
    const html = renderPage(atolyeTheme, "CheckoutPage", { view: view(), actions })
    for (const field of [
      "email",
      "phone",
      "first_name",
      "last_name",
      "province",
      "district",
      "neighborhood",
      "address_1",
    ]) {
      expect(html).toContain(`name="${field}"`)
      expect(html).toContain(`id="${field}"`)
    }
    expect(html.match(/type="submit"/g)).toHaveLength(1)
    expect(html).toContain("Kargo seçeneklerine geç")
    // The browser's address book can fill the province (its districts load from it)
    expect(html).toMatch(/<select[^>]*autoComplete="address-level1"/)
    expect(html).toContain('<option value="20">Denizli</option>')
  })

  it("folds the basket on a phone and keeps the graphite stage beside the steps on a desktop", () => {
    const html = renderPage(atolyeTheme, "CheckoutPage", { view: view(), actions })
    expect(html).toMatch(/<details class="gf-stage[^"]*lg:hidden"/)
    expect(html).toMatch(
      /<aside aria-labelledby="odeme-ozeti" class="gf-stage[^"]*hidden[^"]*lg:flex/
    )
    expect(html).toContain("Hediye paketi")
    expect(html).toContain("Sonraki adımda")
  })

  it("shows the steps before as their summary with a named way back", () => {
    const html = renderPage(atolyeTheme, "CheckoutPage", { view: paying(), actions })
    expect(html).toContain("Ayşe Yılmaz")
    expect(html).toContain('aria-label="Değiştir: Kargo"')
    expect(html).toContain('aria-current="step"')
  })

  it("offers the ways to pay as radios with the contracts, the box to accept and the button", () => {
    const html = renderPage(atolyeTheme, "CheckoutPage", { view: paying(), actions })
    expect(html).toContain('value="pp_bank-transfer_bank-transfer"')
    expect(html).toMatch(/type="radio"[^>]*name="provider_id"/)
    expect(html).toContain('value="pre_information:3"')
    expect(html).toContain('value="distance_sales:2"')
    expect(html).toContain('name="accept"')
    expect(html).toContain("Kart bilgilerine geç")
    expect(html).toContain('name="marketing_email"')
    expect(html).not.toContain('name="birth_date"')
    // Under 1024 px the total stands right over the button, the basket's bar far above by then
    expect(html).toMatch(
      /<p class="[^"]*lg:hidden"><span[^>]*>Toplam<\/span><span[^>]*>[^<]+<\/span><\/p><button type="submit"/
    )
  })

  it("asks the age the cart needs, in its own well", () => {
    const html = renderPage(atolyeTheme, "CheckoutPage", {
      view: paying({ ageLimit: 18 }),
      actions,
    })
    expect(html).toContain('name="birth_date"')
    expect(html).toContain('name="age_confirm"')
    expect(html).toContain("18 yaşını doldurduğumu beyan ederim.")
    expect(html).toContain("Yaş beyanı")
  })

  it("says a page error over the steps", () => {
    const html = renderPage(atolyeTheme, "CheckoutPage", {
      view: view({ error: "Kargo ücreti değişti; kargo seçeneğini yeniden seçin." }),
      actions,
    })
    expect(html).toMatch(/role="alert"[^>]*>Kargo ücreti değişti/)
  })
})

describe("the theme's card form and result pages", () => {
  it("frames the provider's form under its own title, the way back above it", () => {
    const html = renderPage(atolyeTheme, "PaymentFramePage", {
      view: { frameUrl: "https://www.paytr.com/odeme/guvenli/abc", summary, backPath: "/odeme" },
    })
    expect(html).toContain('title="Güvenli kart ödeme formu"')
    expect(html).toContain('src="https://www.paytr.com/odeme/guvenli/abc"')
    expect(html).toContain('href="/odeme"')
    expect(html).toContain("Ödeme adımına dön")
  })

  it("says a refused payment and leads back to the payment step", () => {
    const html = renderPage(atolyeTheme, "CheckoutResultPage", {
      view: { state: "failed", retryPath: null, backPath: "/odeme" },
    })
    expect(html).toContain("Ödeme alınamadı")
    expect(html).toMatch(/<a href="\/odeme" class="gf-btn">Ödeme adımına dön<\/a>/)
  })

  it("waits for the provider with a way to look again", () => {
    const html = renderPage(atolyeTheme, "CheckoutResultPage", {
      view: { state: "pending", retryPath: "/odeme/sonuc?deneme=1", backPath: "/" },
    })
    expect(html).toContain("Ödemeniz onaylanıyor")
    expect(html).toContain('href="/odeme/sonuc?deneme=1"')
  })
})
