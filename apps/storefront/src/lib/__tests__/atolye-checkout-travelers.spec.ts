import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  CheckoutActions,
  CheckoutPageView,
  CheckoutSummaryView,
  TravelersStepView,
} from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * adr/0076 Ek D6b: Atölye draws the travelers step only when the view
 * lists it and carries it and the storefront gives its action; one block
 * per place with only the fields its departure asks, the number's field
 * empty (a saved one only named masked), nothing filled in by the browser.
 */

const base: CheckoutActions = {
  saveAddress: () => Promise.resolve({ ok: true, error: null }),
  chooseShipping: () => Promise.resolve({ ok: true, error: null }),
  placeOrder: () => Promise.resolve({ ok: true, error: null, challenge: null }),
  districts: () => Promise.resolve([]),
  neighborhoods: () => Promise.resolve([]),
}
const actions: CheckoutActions = {
  ...base,
  saveTravelers: () => Promise.resolve({ ok: true, error: null }),
}

const summary: CheckoutSummaryView = {
  lines: [
    { id: "cali_1", title: "Tur", detail: null, quantity: 2, total: "500,00 TL", image: null },
  ],
  items: "500,00 TL",
  discount: null,
  shipping: null,
  total: "500,00 TL",
  ships: false,
}

const travelers: TravelersStepView = {
  groups: [
    {
      slotId: "bkslot_01K0000000000000000000TOUR",
      title: "Kapadokya turu",
      when: "Cumartesi, 12 Aralık 2026 · 09:00",
      level: "identity",
      count: 2,
      people: [
        {
          firstName: "Ayşe",
          lastName: "Yılmaz",
          birthDate: "1990-05-04",
          nationality: "",
          documentMasked: "***1234",
        },
      ],
    },
    {
      slotId: "bkslot_01K0000000000000000000BOAT",
      title: "Tekne turu",
      when: "Pazar, 13 Aralık 2026 · 10:00",
      level: "name",
      count: 1,
      people: [],
    },
  ],
  complete: false,
  summary: null,
  countries: [{ value: "TR", label: "Türkiye" }],
  maxBirthDate: "2026-11-22",
}

const view = (over: Partial<CheckoutPageView> = {}): CheckoutPageView => ({
  step: "travelers",
  steps: ["address", "travelers", "payment"],
  travelers,
  address: {
    values: {
      email: "ayse@quantdijital.com",
      phone: "",
      first_name: "Ayşe",
      last_name: "Yılmaz",
      province: "",
      district: "",
      neighborhood: "",
      address_1: "",
    },
    provinces: [],
    districts: [],
    neighborhoods: [],
  },
  addressSummary: { email: "ayse@quantdijital.com", name: "Ayşe Yılmaz", lines: [], phone: "" },
  shippingOptions: [],
  shippingSelected: null,
  shippingSummary: null,
  paymentMethods: [],
  contracts: {},
  ageLimit: null,
  marketingVersion: "checkout-1",
  summary,
  error: null,
  editPaths: {
    address: "/odeme?adim=adres",
    shipping: "/odeme?adim=kargo",
    travelers: "/odeme?adim=katilimcilar",
    payment: "/odeme",
  },
  invoice: { text: "Faturanız bireysel olarak kesilir.", link: null },
  ...over,
})

const draw = (over: Partial<CheckoutPageView> = {}, with_: CheckoutActions = actions) =>
  renderPage(atolyeTheme, "CheckoutPage", { view: view(over), actions: with_ })

describe("Atölye's travelers step", () => {
  it("draws a block per place with only the fields its departure asks", () => {
    const html = draw()

    expect(html).toContain("Katılımcılar")
    expect(html).toContain("Kapadokya turu")
    expect(html).toContain("Tekne turu")
    for (const n of ["0", "1", "2"]) {
      expect(html).toContain(`name="traveler.${n}.first_name"`)
      expect(html).toContain(`name="traveler.${n}.last_name"`)
    }
    // The tour asks up to the number, the boat only the name
    expect(html).toContain('name="traveler.1.birth_date"')
    expect(html).toContain('name="traveler.1.document_no"')
    expect(html).not.toContain('name="traveler.2.birth_date"')
    expect(html).not.toContain('name="traveler.2.document_no"')
    expect(html).not.toContain("traveler.0.nationality")
    expect(html).toContain('max="2026-11-22"')
  })

  it("fills what was entered but never the number, named only masked", () => {
    const html = draw()

    expect(html).toContain('value="Ayşe"')
    expect(html).toContain('value="1990-05-04"')
    expect(html).toContain("Kayıtlı: ***1234")
    expect(html).not.toMatch(/name="traveler\.0\.document_no"[^>]*value="[^"]+"/)
    expect(html).toContain("şifreli saklanır")
    // Nothing the browser would fill in from another person's details
    expect(html).not.toMatch(/name="traveler\.\d\.[a-z_]+"[^>]*autoComplete="(?!off)/i)
    expect(html.match(/autocomplete="off"/gi)?.length).toBeGreaterThanOrEqual(8)
  })

  it("is not drawn without its view or without the storefront's action", () => {
    const without = draw({ travelers: null })
    expect(without).not.toContain("traveler.0.first_name")
    expect(draw({}, base)).not.toContain("traveler.0.first_name")
  })
})
