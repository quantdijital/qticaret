// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SEARCH_FORM_DEFAULTS } from "@qticaret/types/search-form"
import type { SearchFormView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { EMPTY_VALUES, searchFormView } from "@/lib/views/search-form"
import { SearchForm } from "../../../../../packages/themes/atolye/src/parts/SearchForm"

/**
 * The search box's calendar at work (adr/0077 §6, PR6): the page as sent
 * is the plain form's, the calendar opens from the dates once the page
 * runs and asks for its month's prices only then, a range of 62 days at
 * most, three flexible months at most, the keys move through the days,
 * and Apply writes the fields the form already sends.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const view = (booking = true): SearchFormView =>
  searchFormView(
    {
      settings: { ...SEARCH_FORM_DEFAULTS },
      booking,
      categories: [{ handle: "doga", name: "Doğa turları" }],
      where: null,
      today: "2026-11-24",
    },
    EMPTY_VALUES,
    t
  )

const fetched: string[] = []
vi.stubGlobal("fetch", (address: string) => {
  fetched.push(address)
  // A party of seven: the storefront failing (the calendar holds it)
  if (address.includes("kisi=7")) {
    return Promise.resolve(new Response("{}", { status: 502 }))
  }
  const month = new URLSearchParams(address.split("?")[1]).get("month") ?? ""
  const day = {
    date: `${month}-05`,
    departures: 2,
    price: "12.400,00 TL",
    short: "₺12,4 B",
    whole: "₺12.400",
  }
  return Promise.resolve(new Response(JSON.stringify({ month, days: [day] })))
})

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  fetched.length = 0
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  host.remove()
})

const settle = () => new Promise((done) => setTimeout(done, 20))
/** Past the calendar's pause before it asks for a month (`MONTH_DELAY_MS`, 200 ms). */
const asked = () =>
  act(async () => {
    await new Promise((done) => setTimeout(done, 260))
  })
const dialog = () => document.querySelector<HTMLElement>("[role=dialog]")
const field = (name: string) => host.querySelector<HTMLInputElement>(`[name="${name}"]`)
const day = (date: string) => document.querySelector<HTMLButtonElement>(`[data-day="${date}"]`)
const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (each) => each.textContent === name || each.getAttribute("aria-label") === name
  )

async function press(element: HTMLElement | null | undefined) {
  if (!element) {
    throw new Error("nothing to press")
  }
  await act(async () => {
    element.click()
    await settle()
  })
}

async function draw(form = view()) {
  await act(async () => {
    root.render(<SearchForm form={form} />)
    await settle()
  })
}

describe("the search calendar", () => {
  it("leaves the page as sent the plain form's: no calendar drawn, nothing asked", () => {
    const form = view()
    const plain = form.dates ? { ...form.dates } : null
    delete plain?.calendar
    const without = { ...form, dates: plain }
    expect(form.dates?.calendar).toBeDefined()
    expect(renderToStaticMarkup(<SearchForm form={form} />)).toBe(
      renderToStaticMarkup(<SearchForm form={without} />)
    )
    expect(renderToStaticMarkup(<SearchForm form={form} />)).not.toContain("dialog")
    expect(fetched).toEqual([])
  })

  it("draws no dates and no calendar while the shop sells no dated products", async () => {
    await draw(view(false))
    expect(field("tarih_baslangic")).toBeNull()
    expect(host.querySelector("[aria-haspopup]")).toBeNull()
  })

  it("opens from a day field as a modal dialog and asks for the month with the form's party", async () => {
    await draw()
    const from = field("tarih_baslangic")
    expect(from?.readOnly).toBe(true)
    expect(fetched).toEqual([])
    const people = host.querySelector<HTMLSelectElement>('select[name="kisi"]')
    if (people) {
      people.value = "3"
    }
    await press(from)
    expect(dialog()?.getAttribute("aria-modal")).toBe("true")
    await asked()
    expect(fetched).toEqual(["/api/search/calendar?month=2026-11&kisi=3"])
    expect(day("2026-11-23")?.getAttribute("aria-disabled")).toBe("true")
    await press(button(t("search.calendar_next")))
    await asked()
    expect(fetched.at(-1)).toBe("/api/search/calendar?month=2026-12&kisi=3")
    expect(day("2026-12-05")?.getAttribute("aria-label")).toBe(
      "5 Aralık 2026, en düşük 12.400,00 TL, 2 kalkış"
    )
    expect(day("2026-12-05")?.textContent).toContain("₺12,4 B")
    // No departure: pale, still a day a range can start on
    expect(day("2026-12-06")?.getAttribute("aria-label")).toBe("6 Aralık 2026, kalkış yok")
    expect(day("2026-12-06")?.hasAttribute("aria-disabled")).toBe(false)
  })

  it("writes the range picked into the day fields on Apply, and no month", async () => {
    await draw()
    await press(field("tarih_bitis"))
    await press(button(t("search.calendar_next")))
    await press(day("2026-12-05"))
    await press(day("2026-12-10"))
    expect(day("2026-12-07")?.getAttribute("aria-pressed")).toBe("true")
    await press(button(t("search.calendar_apply")))
    expect(dialog()).toBeNull()
    expect(field("tarih_baslangic")?.value).toBe("2026-12-05")
    expect(field("tarih_bitis")?.value).toBe("2026-12-10")
    expect(field("ay")).toBeNull()
  })

  it("takes no end more than 62 days from the start, and says so", async () => {
    await draw()
    await press(field("tarih_baslangic"))
    await press(button(t("search.calendar_next")))
    await press(day("2026-12-01"))
    await press(button(t("search.calendar_next")))
    expect(day("2027-01-31")?.hasAttribute("aria-disabled")).toBe(false)
    await press(button(t("search.calendar_next")))
    expect(day("2027-02-01")?.getAttribute("aria-disabled")).toBe("true")
    await press(day("2027-02-01"))
    expect(dialog()?.textContent).toContain("En çok 62 gün seçilebilir.")
    expect(day("2027-02-01")?.getAttribute("aria-pressed")).toBe("false")
  })

  it("takes three flexible months at most and sends them as one `ay`", async () => {
    await draw()
    await press(button(t("search.form_any_time")))
    const tab = dialog()?.querySelector('[role="tab"][aria-selected="true"]')
    expect(tab?.textContent).toBe(t("search.calendar_flexible"))
    expect(fetched).toEqual([])
    for (const month of ["Ocak 2027", "Aralık 2026", "Şubat 2027", "Mart 2027"]) {
      await press(button(month))
    }
    expect(button("Mart 2027")?.getAttribute("aria-pressed")).toBe("false")
    expect(dialog()?.textContent).toContain("En çok 3 ay seçilebilir.")
    await press(button(t("search.calendar_apply")))
    expect(field("ay")?.value).toBe("2026-12,2027-01,2027-02")
    expect(field("ay")?.type).toBe("hidden")
    expect(field("tarih_baslangic")?.value).toBe("")
    expect(host.textContent).toContain("Aralık 2026, Ocak 2027, Şubat 2027")
  })

  it("moves through the days with the arrows and closes on Escape, the focus back on the field", async () => {
    await draw()
    const from = field("tarih_baslangic")
    from?.focus()
    await press(from)
    const today = day("2026-11-24")
    expect(today?.tabIndex).toBe(0)
    await act(async () => {
      today?.focus()
      today?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
      await settle()
    })
    expect(document.activeElement?.getAttribute("data-day")).toBe("2026-11-25")
    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      )
      await settle()
    })
    // A week on, into the next month: its grid shown, then its prices
    expect(document.activeElement?.getAttribute("data-day")).toBe("2026-12-02")
    await asked()
    expect(day("2026-12-05")?.getAttribute("aria-label")).toContain("2 kalkış")
    await act(async () => {
      dialog()?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
      await settle()
    })
    expect(dialog()).toBeNull()
    expect(field("tarih_baslangic")?.value).toBe("")
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(field("tarih_baslangic"))
    })
  })

  it("asks only for the month the shopper stops on when paging quickly (#310 D2)", async () => {
    await draw()
    const people = host.querySelector<HTMLSelectElement>('select[name="kisi"]')
    if (people) {
      people.value = "4"
    }
    await press(field("tarih_baslangic"))
    await press(button(t("search.calendar_next")))
    await press(button(t("search.calendar_next")))
    expect(fetched).toEqual([])
    await asked()
    expect(fetched).toEqual(["/api/search/calendar?month=2027-01&kisi=4"])
  })

  it("does not ask again for a month that failed, opened again within 30 seconds (#310 D2)", async () => {
    await draw()
    const people = host.querySelector<HTMLSelectElement>('select[name="kisi"]')
    if (people) {
      people.value = "7"
    }
    await press(field("tarih_baslangic"))
    await asked()
    expect(fetched).toEqual(["/api/search/calendar?month=2026-11&kisi=7"])
    expect(dialog()?.textContent).toContain(t("search.calendar_failed"))
    await press(button(t("search.calendar_close")))
    expect(dialog()).toBeNull()
    await press(field("tarih_baslangic"))
    expect(dialog()?.textContent).toContain(t("search.calendar_failed"))
    await asked()
    expect(fetched).toHaveLength(1)
  })
})
