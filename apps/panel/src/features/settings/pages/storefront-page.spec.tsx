import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { URL, answer, card, posts, renderPage } from "./storefront-page.fixtures"
import type { Init } from "./storefront-page.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The menus' card points at their own screen (adr/0049)
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

describe("StorefrontPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    answer(fetchMock)
  })

  it("shows what the shop saved, each part in its own card", async () => {
    renderPage()

    expect(await screen.findByRole("textbox", { name: "1. duyuru" })).toHaveValue(
      "1500 TL ve üzeri kargo bedava"
    )
    expect(screen.getByRole("combobox", { name: "1. rozetin simgesi" })).toHaveTextContent("Kargo")
    expect(screen.getByRole("textbox", { name: "1. rozetin başlığı" })).toHaveValue(
      "Aynı gün kargo"
    )
    expect(screen.getByRole("textbox", { name: "1. rozetin açıklaması" })).toHaveValue("")
    // The WhatsApp number is a store detail now (adr/0048): no card for it here
    expect(screen.queryByRole("heading", { name: "WhatsApp" })).toBeNull()
    expect(screen.queryByRole("textbox", { name: "WhatsApp numarası" })).toBeNull()
    // The menus are records of their own now (adr/0049): a pointer where their cards were
    expect(within(card("Menüler")).getByRole("link", { name: "Menülere git" })).toHaveAttribute(
      "href",
      "/storefront/menus"
    )
    expect(screen.queryByRole("heading", { name: "Üst bağlantılar" })).toBeNull()
    expect(screen.queryByRole("heading", { name: "Alt bilgi sütunları" })).toBeNull()
    expect(screen.getByRole("textbox", { name: "Ana renk" })).toHaveValue("")
    expect(screen.getByRole("button", { name: "Temanın rengine dön" })).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledWith(URL)
  })

  it("refuses a script as an address before saving and sends nothing", async () => {
    renderPage()
    await screen.findByRole("textbox", { name: "Başlık" })
    const hero = card("Ana sayfa girişi")

    await userEvent.type(within(hero).getByRole("textbox", { name: "Başlık" }), "Yeni sezon")
    await userEvent.click(within(hero).getByRole("button", { name: "Düğme ekle" }))
    await userEvent.type(
      within(hero).getByRole("textbox", { name: "1. düğmenin yazısı" }),
      "Kampanya"
    )
    const address = within(hero).getByRole("textbox", { name: "1. düğmenin adresi" })
    await userEvent.type(address, "javascript:alert(1)")
    await userEvent.click(within(hero).getByRole("button", { name: "Kaydet" }))

    expect(await within(hero).findByRole("alert")).toHaveTextContent(
      "Adres / ile başlayan bir mağaza sayfası ya da https:// ile başlayan bir site olmalı."
    )
    expect(address).toHaveAttribute("aria-invalid", "true")
    expect(posts(fetchMock)).toEqual([])
  })

  it("saves a badge without a description as none", async () => {
    renderPage()
    const title = await screen.findByRole("textbox", { name: "1. rozetin başlığı" })
    const badges = card("Güven rozetleri")

    await userEvent.type(title, " bugün")
    await userEvent.click(within(badges).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { trust_badges: [{ icon: "truck", title: "Aynı gün kargo bugün", text: null }] },
      })
    })
  })

  it("puts back what was saved on undo, even in a field typed in", async () => {
    renderPage()
    const line = await screen.findByRole("textbox", { name: "1. duyuru" })
    const announcements = card("Duyuru şeridi")

    await userEvent.type(line, " bugün")
    await userEvent.click(within(announcements).getByRole("button", { name: "Geri al" }))

    // The list's rows are drawn again from what was saved
    expect(screen.getByRole("textbox", { name: "1. duyuru" })).toHaveValue(
      "1500 TL ve üzeri kargo bedava"
    )
  })
})
