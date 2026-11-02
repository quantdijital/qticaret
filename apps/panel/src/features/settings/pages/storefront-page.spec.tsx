import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { URL, answer, card, posts, renderPage } from "./storefront-page.fixtures"
import type { Init } from "./storefront-page.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

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
    expect(screen.getByRole("textbox", { name: "1. bağlantının adı" })).toHaveValue("Hakkımızda")
    expect(screen.getByRole("textbox", { name: "1. bağlantının adresi" })).toHaveValue(
      "/hakkimizda"
    )
    expect(screen.getByRole("textbox", { name: "1. sütunun başlığı" })).toHaveValue("Kurumsal")
    expect(screen.getByRole("textbox", { name: "1. sütun, 1. bağlantının adresi" })).toHaveValue(
      "/mesafeli-satis"
    )
    expect(screen.getByRole("combobox", { name: "1. rozetin simgesi" })).toHaveTextContent("Kargo")
    expect(screen.getByRole("textbox", { name: "1. rozetin başlığı" })).toHaveValue(
      "Aynı gün kargo"
    )
    expect(screen.getByRole("textbox", { name: "1. rozetin açıklaması" })).toHaveValue("")
    // The WhatsApp number is a store detail now (adr/0048): no card for it here
    expect(screen.queryByRole("heading", { name: "WhatsApp" })).toBeNull()
    expect(screen.queryByRole("textbox", { name: "WhatsApp numarası" })).toBeNull()
    expect(within(card("Menü")).getByText(/vitrin üst kategorilerinizi/)).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Ana renk" })).toHaveValue("")
    expect(screen.getByRole("button", { name: "Temanın rengine dön" })).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledWith(URL)
  })

  it("adds a top link and saves the list whole, and only that field", async () => {
    renderPage()
    await screen.findByRole("textbox", { name: "1. bağlantının adı" })
    const topLinks = card("Üst bağlantılar")

    await userEvent.click(within(topLinks).getByRole("button", { name: "Bağlantı ekle" }))
    await userEvent.type(
      within(topLinks).getByRole("textbox", { name: "2. bağlantının adı" }),
      "İletişim"
    )
    await userEvent.type(
      within(topLinks).getByRole("textbox", { name: "2. bağlantının adresi" }),
      " /iletisim "
    )
    await userEvent.click(within(topLinks).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: {
          top_links: [
            { label: "Hakkımızda", href: "/hakkimizda" },
            { label: "İletişim", href: "/iletisim" },
          ],
        },
      })
    })
  })

  it("refuses a script as an address before saving and sends nothing", async () => {
    renderPage()
    await screen.findByRole("textbox", { name: "1. bağlantının adı" })
    const topLinks = card("Üst bağlantılar")

    await userEvent.click(within(topLinks).getByRole("button", { name: "Bağlantı ekle" }))
    await userEvent.type(
      within(topLinks).getByRole("textbox", { name: "2. bağlantının adı" }),
      "Kampanya"
    )
    const address = within(topLinks).getByRole("textbox", { name: "2. bağlantının adresi" })
    await userEvent.type(address, "javascript:alert(1)")
    await userEvent.click(within(topLinks).getByRole("button", { name: "Kaydet" }))

    expect(await within(topLinks).findByRole("alert")).toHaveTextContent(
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

  it("saves a menu item with a sub-link as the server takes it", async () => {
    renderPage()
    await screen.findByRole("textbox", { name: "1. duyuru" })
    const menu = card("Menü")

    await userEvent.click(within(menu).getByRole("button", { name: "Menü öğesi ekle" }))
    await userEvent.type(
      within(menu).getByRole("textbox", { name: "1. menü öğesinin adı" }),
      "Kampanyalar"
    )
    await userEvent.type(
      within(menu).getByRole("textbox", { name: "1. menü öğesinin adresi" }),
      "/kampanyalar"
    )
    await userEvent.click(within(menu).getByRole("button", { name: "Alt bağlantı ekle" }))
    await userEvent.type(
      within(menu).getByRole("textbox", { name: "1. menü öğesi, 1. bağlantının adı" }),
      "Outlet"
    )
    await userEvent.type(
      within(menu).getByRole("textbox", { name: "1. menü öğesi, 1. bağlantının adresi" }),
      " https://outlet.example.com/ "
    )
    await userEvent.click(within(menu).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: {
          menu: [
            {
              label: "Kampanyalar",
              href: "/kampanyalar",
              children: [{ label: "Outlet", href: "https://outlet.example.com/" }],
            },
          ],
        },
      })
    })
  })

  it("refuses a script as a sub-link's address before saving", async () => {
    renderPage()
    await screen.findByRole("textbox", { name: "1. duyuru" })
    const menu = card("Menü")

    await userEvent.click(within(menu).getByRole("button", { name: "Menü öğesi ekle" }))
    await userEvent.type(
      within(menu).getByRole("textbox", { name: "1. menü öğesinin adı" }),
      "Kampanyalar"
    )
    await userEvent.type(
      within(menu).getByRole("textbox", { name: "1. menü öğesinin adresi" }),
      "/kampanyalar"
    )
    await userEvent.click(within(menu).getByRole("button", { name: "Alt bağlantı ekle" }))
    await userEvent.type(
      within(menu).getByRole("textbox", { name: "1. menü öğesi, 1. bağlantının adı" }),
      "Kampanya"
    )
    const address = within(menu).getByRole("textbox", {
      name: "1. menü öğesi, 1. bağlantının adresi",
    })
    await userEvent.type(address, "javascript:alert(1)")
    await userEvent.click(within(menu).getByRole("button", { name: "Kaydet" }))

    expect(await within(menu).findByRole("alert")).toHaveTextContent(
      "Adres / ile başlayan bir mağaza sayfası ya da https:// ile başlayan bir site olmalı."
    )
    expect(address).toHaveAttribute("aria-invalid", "true")
    expect(posts(fetchMock)).toEqual([])
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
