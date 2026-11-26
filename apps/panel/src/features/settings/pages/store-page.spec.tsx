import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { storeTabSearch } from "@/features/settings/store-tabs"
import { APPEARANCE, SAVED, answer, card, posts, renderPage } from "./store-page.fixtures"
import type { Init } from "./store-page.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const storeApi = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn() }))
// The address's search (`?part=`), which a tab click changes as the router would
const route = vi.hoisted(() => {
  let search: Record<string, unknown> = {}
  const listeners = new Set<() => void>()
  return {
    get: () => search,
    set: (next: Record<string, unknown>) => {
      search = next
      listeners.forEach((listener) => {
        listener()
      })
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
})

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { store: storeApi } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", async () => {
  const { useSyncExternalStore } = await import("react")
  type Next = (previous: Record<string, unknown>) => Record<string, unknown>
  return {
    useSearch: () => useSyncExternalStore(route.subscribe, route.get),
    useNavigate: () => (options: { search: Next }) => {
      route.set(options.search(route.get()))
      return Promise.resolve()
    },
  }
})

const STORE_URL = "/admin/platform-settings/store"

describe("StorePage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    answer(fetchMock)
    storeApi.list.mockResolvedValue({ stores: [{ id: "store_1", name: "Örnek Bıçak" }] })
    storeApi.update.mockResolvedValue({ store: { id: "store_1", name: "Örnek Bıçak Evi" } })
    route.set({})
  })

  it("opens on the general tab and moves between tabs through the address", async () => {
    renderPage()

    expect(await screen.findByRole("textbox", { name: /^Mağaza adı/ })).toHaveValue("Örnek Bıçak")
    expect(
      screen.getAllByRole("tab").map((tab) => [tab.textContent, tab.getAttribute("aria-selected")])
    ).toEqual([
      ["Genel", "true"],
      ["İletişim", "false"],
      ["Yasal kimlik", "false"],
      ["Sosyal hesaplar", "false"],
    ])
    expect(screen.getByRole("img", { name: "Logo (açık zemin)" })).toHaveAttribute(
      "src",
      "https://cdn.ornek.com/logo.png"
    )
    const brand = card("Marka")
    expect(within(brand).getByText("Logo yok")).toBeInTheDocument()
    // An SVG logo's text: outlined, since its font declarations are cleaned away
    expect(within(brand).getByText(/eğriye çevir/)).toBeInTheDocument()
    // No site icon yet: the storefront's own, said beside the empty frame
    expect(within(brand).getByText("Simge yok")).toBeInTheDocument()
    expect(within(brand).getByText(/vitrin varsayılan simgeyi gösterir/)).toBeInTheDocument()
    expect(card("Bölge ve birimler")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("tab", { name: "İletişim" }))

    expect(route.get()).toEqual({ part: "contact" })
    // The phone as a Turkish reader writes it, not as stored (+90…)
    expect(await screen.findByRole("textbox", { name: "Telefon" })).toHaveValue("0212 123 45 67")
    expect(screen.getByRole("textbox", { name: "E-posta" })).toHaveValue("destek@ornek.com")
    expect(card("Çalışma saatleri")).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: /^Mağaza adı/ })).toBeNull()
  })

  it("lays the brand beside the region as tall, its three pictures in one row of frames", async () => {
    renderPage()
    await screen.findByRole("textbox", { name: /^Mağaza adı/ })
    const brand = card("Marka")
    const region = card("Bölge ve birimler")

    // One PageGrid row, 8 + 4: its cells stretch to one height
    expect(brand.parentElement).toBe(region.parentElement)
    expect(brand.parentElement).toHaveClass("grid", "items-stretch", "xl:grid-cols-12")
    expect(brand).toHaveClass("xl:col-span-8")
    expect(region).toHaveClass("xl:col-span-4")
    // Every field in place: the name, the three pictures, the time zone and the units
    const tiles = ["Logo (açık zemin)", "Logo (koyu zemin)", "Site simgesi (favicon)"].map((name) =>
      within(brand).getByRole("group", { name })
    )
    const row = tiles[0]?.parentElement
    expect(row).toHaveClass("grid", "@lg:grid-cols-3")
    for (const tile of tiles) {
      expect(tile.parentElement).toBe(row)
      // Label, frame and words on the row's own lines: the frames line up, one height
      expect(tile).toHaveClass("@lg:row-span-3", "@lg:grid-rows-subgrid")
      expect(within(tile).getAllByRole("button")[0]).toHaveClass("h-24", "w-full")
    }
    expect(within(region).getByRole("combobox", { name: "Saat dilimi" })).toBeInTheDocument()
    expect(
      within(region)
        .getAllByRole("radio")
        .map((radio) => radio.parentElement?.textContent)
    ).toEqual(["Gram (g)", "Kilogram (kg)", "Santimetre (cm)", "Milimetre (mm)"])
    // The empty ones a dashed frame of the same size; a logo on its own ground once chosen
    const [light, dark, icon] = tiles.map((tile) => within(tile).getAllByRole("button")[0])
    expect(light).toHaveClass("bg-card")
    expect(dark).toHaveClass("border-dashed")
    expect(dark).toHaveTextContent("Logo yok")
    expect(icon).toHaveClass("border-dashed")
    expect(icon).toHaveTextContent("Simge yok")
    // What any of them may be, once under the row
    expect(within(brand).getByText(/PNG ya da SVG olabilir/)).toBeInTheDocument()
  })

  it("fills the region card to the row's height: fields on top, its facts at the foot", async () => {
    renderPage()
    await screen.findByRole("textbox", { name: /^Mağaza adı/ })
    const region = card("Bölge ve birimler")
    const form = region.querySelector("form")

    // The card, its body and its form each take the height the row gives
    expect(region).toHaveClass("flex", "flex-col")
    expect(form?.parentElement).toHaveClass("flex-1", "flex-col")
    expect(form).toHaveClass("flex-1", "flex-col")
    // The shop's clock in the zone chosen and what the units change, pushed to the foot
    const clock = within(region).getByText(/^Mağaza saati: \d{2}[.:]\d{2}$/)
    const facts = clock.closest("p")?.parentElement
    expect(facts).toHaveClass("mt-auto")
    expect(facts).toHaveTextContent("Kayıtlı ürünlerin değerleri çevrilmez.")

    // A change shows the page's header save under the facts; the form still fills the card
    await userEvent.click(within(region).getByRole("radio", { name: "Kilogram (kg)" }))
    const saveButton = within(region).getByRole("button", { name: "Kaydet" })
    expect(saveButton).toBeVisible()
    expect(facts?.nextElementSibling).toContainElement(saveButton)
    expect(form).toHaveClass("flex-1")
  })

  it("opens the tab a link names, and keeps only a tab it knows in the address", async () => {
    route.set({ part: "social" })
    renderPage()

    expect(await screen.findByRole("textbox", { name: "1. hesabın adresi" })).toHaveValue(
      "https://instagram.com/ornek"
    )
    expect(storeTabSearch({ part: "legal" })).toEqual({ part: "legal" })
    expect(storeTabSearch({ part: "whatsapp" })).toEqual({})
    expect(storeTabSearch({ part: 3 })).toEqual({})
  })

  it("renames the shop and removes a logo in one save", async () => {
    renderPage()
    const name = await screen.findByRole("textbox", { name: /^Mağaza adı/ })
    const brand = card("Marka")

    await userEvent.type(name, " Evi")
    await userEvent.click(
      within(brand).getByRole("button", { name: "Logo (açık zemin): görseli kaldır" })
    )
    await userEvent.click(within(brand).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/appearance", {
        method: "POST",
        body: { logo_light_url: null, logo_dark_url: null },
      })
    })
    expect(storeApi.update).toHaveBeenCalledWith("store_1", { name: "Örnek Bıçak Evi" })
  })

  it("shows the site icon as a tab and a home screen show it, and takes it off alone", async () => {
    const icon = "https://cdn.ornek.com/simge.png"
    answer(fetchMock, { ...SAVED, appearance: { ...APPEARANCE, favicon_url: icon } })
    renderPage()
    await screen.findByRole("textbox", { name: /^Mağaza adı/ })
    const brand = card("Marka")

    expect(within(brand).getByRole("img", { name: "Site simgesi (favicon)" })).toHaveAttribute(
      "src",
      icon
    )
    expect(within(brand).getByText("Tarayıcı sekmesi")).toBeInTheDocument()
    expect(within(brand).getByText("Ana ekran")).toBeInTheDocument()
    // The tab names the shop beside the icon
    expect(within(brand).getByText("Örnek Bıçak")).toBeInTheDocument()

    await userEvent.click(
      within(brand).getByRole("button", { name: "Site simgesi (favicon): görseli kaldır" })
    )
    await userEvent.click(within(brand).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/appearance", {
        method: "POST",
        body: { favicon_url: null },
      })
    })
    expect(storeApi.update).not.toHaveBeenCalled()
  })

  it("saves the contact details to the store, the address to the legal identity", async () => {
    route.set({ part: "contact" })
    renderPage()
    const email = await screen.findByRole("textbox", { name: "E-posta" })
    const contact = card("İletişim bilgileri")

    await userEvent.clear(email)
    await userEvent.type(email, "satis@ornek.com")
    await userEvent.type(
      screen.getByRole("textbox", { name: "WhatsApp numarası" }),
      "0532 765 43 21"
    )
    await userEvent.type(
      screen.getByRole("textbox", { name: "Harita bağlantısı" }),
      " https://maps.app.goo.gl/abc "
    )
    await userEvent.type(
      screen.getByRole("textbox", { name: "Açık adres" }),
      "Moda Cad. 1, Kadıköy"
    )
    await userEvent.click(within(contact).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/legal", {
        method: "POST",
        body: { address: "Moda Cad. 1, Kadıköy" },
      })
    })
    expect(fetchMock).toHaveBeenCalledWith(STORE_URL, {
      method: "POST",
      body: {
        contact_email: "satis@ornek.com",
        contact_phone: "0212 123 45 67",
        whatsapp_phone: "0532 765 43 21",
        map_url: "https://maps.app.goo.gl/abc",
      },
    })
  })

  it("refuses a number that is not Turkish and a map link without https before saving", async () => {
    route.set({ part: "contact" })
    renderPage()
    const whatsapp = await screen.findByRole("textbox", { name: "WhatsApp numarası" })
    const contact = card("İletişim bilgileri")

    await userEvent.type(whatsapp, "12345")
    await userEvent.type(
      screen.getByRole("textbox", { name: "Harita bağlantısı" }),
      "http://maps.example.com"
    )
    await userEvent.click(within(contact).getByRole("button", { name: "Kaydet" }))

    const alerts = await within(contact).findAllByRole("alert")
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      "Geçerli bir Türkiye telefon numarası girin.",
      "Adres https:// ile başlamalı.",
    ])
    expect(whatsapp).toHaveAttribute("aria-invalid", "true")
    expect(posts(fetchMock)).toEqual([])
  })

  it("saves the opening hours from the contact tab as one list", async () => {
    route.set({ part: "contact" })
    renderPage()
    const saturday = await screen.findByRole("switch", { name: "Cumartesi açık" })
    const hours = card("Çalışma saatleri")

    await userEvent.click(saturday)
    await userEvent.click(within(hours).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(STORE_URL, {
        method: "POST",
        body: {
          opening_hours: [
            { day: 1, opens: "09:00", closes: "18:00" },
            { day: 6, opens: "09:00", closes: "18:00" },
          ],
        },
      })
    })
  })
})
