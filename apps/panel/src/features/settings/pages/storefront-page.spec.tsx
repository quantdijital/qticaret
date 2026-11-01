import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { StorefrontPage } from "./storefront-page"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const URL = "/admin/platform-settings/storefront"

const SAVED: StorefrontSettings = {
  announcements: ["1500 TL ve üzeri kargo bedava"],
  top_links: [{ label: "Hakkımızda", href: "/hakkimizda" }],
  footer_groups: [
    { title: "Kurumsal", links: [{ label: "Mesafeli satış", href: "/mesafeli-satis" }] },
  ],
  trust_badges: [{ icon: "truck", title: "Aynı gün kargo", text: null }],
  whatsapp_phone: "+905321234567",
}

interface Init {
  method?: string
  body?: Partial<StorefrontSettings>
}

const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <StorefrontPage />
    </QueryClientProvider>
  )
}

/** The card under a title; each has its own save button. */
function card(title: string): HTMLElement {
  const section = screen.getByRole("heading", { name: title }).closest<HTMLElement>("section")
  if (!section) throw new Error(`No card titled ${title}`)
  return section
}

describe("StorefrontPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_url: string, init?: Init) =>
      Promise.resolve({ section: "storefront", values: { ...SAVED, ...init?.body }, version: 2 })
    )
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
    expect(screen.getByRole("textbox", { name: "WhatsApp numarası" })).toHaveValue("+905321234567")
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
    expect(posts()).toEqual([])
  })

  it("saves a badge without a description as none, and a cleared WhatsApp number as none", async () => {
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

    const whatsapp = card("WhatsApp")
    await userEvent.clear(within(whatsapp).getByRole("textbox", { name: "WhatsApp numarası" }))
    await userEvent.click(within(whatsapp).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { whatsapp_phone: null },
      })
    })
  })

  it("refuses a number that is not Turkish", async () => {
    renderPage()
    const phone = await screen.findByRole("textbox", { name: "WhatsApp numarası" })
    const whatsapp = card("WhatsApp")

    await userEvent.clear(phone)
    await userEvent.type(phone, "12345")
    await userEvent.click(within(whatsapp).getByRole("button", { name: "Kaydet" }))

    expect(await within(whatsapp).findByRole("alert")).toHaveTextContent(
      "Geçerli bir Türkiye telefon numarası girin."
    )
    expect(posts()).toEqual([])
  })
})
