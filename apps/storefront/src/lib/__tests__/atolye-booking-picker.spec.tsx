// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { ActionResult, BookingView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
// The theme's own parts: it exports pages, not these
import { Booking } from "../../../../../packages/themes/atolye/src/product/Booking"
import { bookingWords } from "../../../../../packages/themes/atolye/src/product/booking-words"
import {
  canAddOne,
  fitCounts,
  initialCounts,
  placesOf,
  totalKurus,
} from "../../../../../packages/themes/atolye/src/product/booking-picks"

/**
 * The departure picker at work (adr/0076 §10): the counts grow only as
 * far as the chosen departure's places and the shop's cap allow, an
 * infant only beside a seat, a new departure holds the counts to its own
 * room, and the total follows the server's category prices. The form
 * sends the departure and the counts, never a price.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const view: BookingView = {
  categories: [
    { variantId: "variant_yetiskin", title: "Yetişkin", pax: 1, ages: null },
    { variantId: "variant_cocuk", title: "Çocuk", pax: 1, ages: "2–11 yaş" },
    { variantId: "variant_bebek", title: "Bebek", pax: 0, ages: "2 yaşa kadar" },
  ],
  departures: [
    {
      id: "bkslot_bol",
      startsAt: "2026-12-12T06:00:00.000Z",
      label: "Cumartesi, 12 Aralık 2026 · 09:00",
      available: 12,
      status: "open",
      prices: [
        { variantId: "variant_yetiskin", price: "1.500,00 TL", kurus: 150000 },
        { variantId: "variant_cocuk", price: "750,00 TL", kurus: 75000 },
        { variantId: "variant_bebek", price: "0,00 TL", kurus: 0 },
      ],
    },
    {
      id: "bkslot_az",
      startsAt: "2026-12-19T06:00:00.000Z",
      label: "Cumartesi, 19 Aralık 2026 · 09:00",
      available: 2,
      status: "open",
      prices: [
        { variantId: "variant_yetiskin", price: "1.750,00 TL", kurus: 175000 },
        { variantId: "variant_bebek", price: "0,00 TL", kurus: 0 },
      ],
    },
  ],
  fewLeft: 5,
  maxUnits: 4,
}

describe("the picker's sums", () => {
  const [plenty, few] = view.departures
  const [adult, child, infant] = view.categories

  it("opens on one adult and counts places, infants taking none", () => {
    const counts = initialCounts(view.categories)
    expect(counts).toEqual({ variant_yetiskin: 1, variant_cocuk: 0, variant_bebek: 0 })
    expect(placesOf(view.categories, { ...counts, variant_bebek: 2 })).toBe(1)
  })

  it("lets a count grow up to the room (free places, the shop's cap) and infants per seat", () => {
    if (!plenty || !few || !adult || !child || !infant) {
      throw new Error("fixture")
    }
    // The cap of 4 binds on the departure of 12
    expect(canAddOne(view, plenty, adult, { variant_yetiskin: 3 })).toBe(true)
    expect(canAddOne(view, plenty, adult, { variant_yetiskin: 4 })).toBe(false)
    // Two free places on the other
    expect(canAddOne(view, few, adult, { variant_yetiskin: 2 })).toBe(false)
    // No price for a child there
    expect(canAddOne(view, few, child, { variant_yetiskin: 1 })).toBe(false)
    // Two infants per seat
    expect(canAddOne(view, plenty, infant, { variant_yetiskin: 1, variant_bebek: 1 })).toBe(true)
    expect(canAddOne(view, plenty, infant, { variant_yetiskin: 1, variant_bebek: 2 })).toBe(false)
  })

  it("holds the counts to a new departure and adds up its prices", () => {
    const fitted = fitCounts(view, few ?? null, {
      variant_yetiskin: 3,
      variant_cocuk: 1,
      variant_bebek: 3,
    })
    expect(fitted).toEqual({ variant_yetiskin: 2, variant_cocuk: 0, variant_bebek: 3 })
    expect(totalKurus(few ?? null, fitted)).toBe(350000)
    expect(totalKurus(null, fitted)).toBeNull()
    expect(totalKurus(few ?? null, { variant_yetiskin: 0 })).toBeNull()
  })
})

describe("the picker in the browser", () => {
  let host: HTMLDivElement
  let root: Root
  let sent: FormData | null

  beforeEach(() => {
    sent = null
    host = document.createElement("div")
    document.body.append(host)
    root = createRoot(host)
    const action = (_state: ActionResult, form: FormData): Promise<ActionResult> => {
      sent = form
      return Promise.resolve({ ok: true, error: null })
    }
    act(() => {
      root.render(
        <Booking
          productId="prod_01TUR"
          view={view}
          action={action}
          favorite={null}
          summary={null}
          whatsapp={null}
          words={bookingWords(t)}
        />
      )
    })
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  const button = (label: string) => {
    const found = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
    if (!found) {
      throw new Error(`no button ${label}`)
    }
    return found
  }
  const press = (element: HTMLElement) => {
    act(() => {
      element.click()
    })
  }
  const count = (variant: string) =>
    host.querySelector<HTMLInputElement>(`input[name="qty_${variant}"]`)?.value
  const total = () => host.querySelector('p[aria-live="polite"]')?.textContent ?? ""

  it("grows the counts to the cap, then holds them to a smaller departure", () => {
    const plus = button("Yetişkin sayısını artır")
    press(plus)
    press(plus)
    press(plus)
    expect(count("variant_yetiskin")).toBe("4")
    expect(plus.disabled).toBe(true)
    expect(total()).toContain("4 kişi")
    expect(total()).toContain("6.000,00")

    const other = host.querySelector<HTMLInputElement>("#kalkis-bkslot_az")
    act(() => {
      other?.click()
    })
    expect(count("variant_yetiskin")).toBe("2")
    expect(total()).toContain("3.500,00")
    // No child price on that departure: its plus is off
    expect(button("Çocuk sayısını artır").disabled).toBe(true)
  })

  it("sends the departure and the counts, never a price", async () => {
    press(button("Bebek sayısını artır"))
    const form = host.querySelector<HTMLFormElement>("#rezervasyon-formu")
    const submit = host.querySelector<HTMLButtonElement>('button[type="submit"]')
    await act(async () => {
      form?.requestSubmit(submit)
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    const fields: FormData | null = sent
    expect(fields?.get("slot_id")).toBe("bkslot_bol")
    expect(fields?.get("qty_variant_yetiskin")).toBe("1")
    expect(fields?.get("qty_variant_bebek")).toBe("1")
    expect([...(fields?.keys() ?? [])].some((key) => key.includes("price"))).toBe(false)
  })
})
