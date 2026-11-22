import { describe, expect, it } from "vitest"
import type { CheckoutCart, CheckoutCartLine } from "@/lib/checkout/cart"
import type { StoreCartTravelers } from "@/lib/booking/travelers"

const { t } = await import("@/lib/i18n")
const { travelersView } = await import("../travelers")
const { STEP_PATHS, stepOf, stepsOf } = await import("../checkout-steps")
const { countryOptions } = await import("@/lib/booking/countries")

const TOUR = "bkslot_01K0000000000000000000TOUR"
const NOW = new Date("2026-11-22T12:00:00Z")

const line = (id: string, metadata: Record<string, unknown> | null = null): CheckoutCartLine => ({
  id,
  title: `${id} başlık`,
  product_title: id === "tur" ? "Kapadokya turu" : id,
  subtitle: null,
  variant_title: null,
  thumbnail: null,
  quantity: 2,
  total: 500,
  requires_shipping: id === "kupa",
  metadata,
})

const TOUR_LINE = line("tur", {
  qt_booking: { slot_id: TOUR, starts_at: "2026-12-12T06:00:00.000Z", hold_id: "bkhold_1" },
})

const data = (over: Partial<StoreCartTravelers> = {}): StoreCartTravelers => ({
  needs: [{ slot_id: TOUR, level: "identity", count: 2, starts_at: "2026-12-12T06:00:00.000Z" }],
  travelers: [],
  complete: false,
  ...over,
})

const cart = (over: Partial<CheckoutCart> = {}): CheckoutCart => ({
  id: "cart_1",
  email: "ayse@quantdijital.com",
  completed_at: null,
  shipping_address: {
    first_name: "Ayşe",
    last_name: "Yılmaz",
    phone: "05320000000",
    address_1: "Cumhuriyet Cad. No: 12",
    address_2: "Sırakapılar",
    city: "Merkezefendi",
    province: "Denizli",
    postal_code: "20010",
    country_code: "tr",
  },
  shipping_methods: [],
  items: [TOUR_LINE],
  original_item_total: 500,
  item_total: 500,
  shipping_total: 0,
  total: 500,
  ...over,
})

describe("the travelers step's view", () => {
  it("draws one group per departure that asks, named by its product and day", () => {
    const view = travelersView([line("kupa"), TOUR_LINE], data(), t, NOW)
    expect(view).toMatchObject({
      complete: false,
      summary: null,
      maxBirthDate: "2026-11-22",
      groups: [{ slotId: TOUR, title: "Kapadokya turu", level: "identity", count: 2, people: [] }],
    })
    expect(view?.groups[0]?.when).toContain("12 Aralık 2026")
  })

  it("fills what was entered by position, the number only masked", () => {
    const view = travelersView(
      [TOUR_LINE],
      data({
        complete: true,
        travelers: [
          {
            slot_id: TOUR,
            position: 1,
            first_name: "Can",
            last_name: "Yılmaz",
            birth_date: "2015-03-01T00:00:00.000Z",
            nationality: null,
            document_masked: "***5678",
          },
          {
            slot_id: TOUR,
            position: 0,
            first_name: "Ayşe",
            last_name: "Yılmaz",
            birth_date: "1990-05-04",
            nationality: "TR",
            document_masked: "***1234",
          },
        ],
      }),
      t,
      NOW
    )
    expect(view?.groups[0]?.people).toEqual([
      {
        firstName: "Ayşe",
        lastName: "Yılmaz",
        birthDate: "1990-05-04",
        nationality: "TR",
        documentMasked: "***1234",
      },
      {
        firstName: "Can",
        lastName: "Yılmaz",
        birthDate: "2015-03-01",
        nationality: "",
        documentMasked: "***5678",
      },
    ])
    expect(view?.summary).toBe("2 katılımcı")
  })

  it("is not there when the cart asks for none or could not be read", () => {
    expect(travelersView([TOUR_LINE], null, t)).toBeNull()
    expect(travelersView([TOUR_LINE], data({ needs: [] }), t)).toBeNull()
  })

  it("offers the countries by Turkish name, Türkiye first", () => {
    const countries = countryOptions()
    expect(countries[0]).toEqual({ value: "TR", label: "Türkiye" })
    expect(countries.find((country) => country.value === "DE")?.label).toBe("Almanya")
    expect(new Set(countries.map((country) => country.value)).size).toBe(countries.length)
  })
})

describe("the travelers step among the checkout's", () => {
  it("is listed before the payment only when the cart asks for travelers", () => {
    expect(stepsOf(cart())).toEqual(["address", "payment"])
    expect(stepsOf(cart(), { complete: false })).toEqual(["address", "travelers", "payment"])
    expect(stepsOf(cart({ items: [TOUR_LINE, line("kupa")] }), { complete: true })).toEqual([
      "address",
      "shipping",
      "travelers",
      "payment",
    ])
    expect(STEP_PATHS.travelers).toBe("/odeme?adim=katilimcilar")
  })

  it("opens until they are all in, never past it, and reopens once they are", () => {
    expect(stepOf(cart(), undefined, { complete: false })).toBe("travelers")
    expect(stepOf(cart(), "odeme", { complete: false })).toBe("travelers")
    expect(stepOf(cart(), "adres", { complete: false })).toBe("address")
    expect(stepOf(cart(), undefined, { complete: true })).toBe("payment")
    expect(stepOf(cart(), "katilimcilar", { complete: true })).toBe("travelers")
    expect(stepOf(cart({ shipping_address: null }), "katilimcilar", { complete: true })).toBe(
      "address"
    )
    // A cart that asks for none: the address opens the payment, as before
    expect(stepOf(cart(), "katilimcilar")).toBe("payment")
  })

  it("comes after the shipping, chosen first", () => {
    const shipped = cart({ items: [TOUR_LINE, line("kupa")] })
    expect(stepOf(shipped, "katilimcilar", { complete: false })).toBe("shipping")
  })
})
