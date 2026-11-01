import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { SeoSettings } from "@/features/settings/api/sections"
import { HomeSeoCard } from "./home-seo-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const SAVED: SeoSettings = {
  canonical_host: null,
  url_style: { product: "prefixed", category: "prefixed", brand: "prefixed" },
  title_templates: {
    product: "{ürün_adı} | {mağaza}",
    category: "{kategori} | {mağaza}",
    brand: "{marka} | {mağaza}",
    page: "{başlık} | {mağaza}",
    post: "{başlık} | {mağaza}",
    landing: "{başlık} | {mağaza}",
  },
  description_templates: { product: "{kısa_açıklama}" },
  robots_txt: "User-agent: *\nAllow: /",
  ai_crawler_preset: "ai_search_visible",
  default_og_image: null,
  home: { title: null, description: "Eski açıklama" },
}

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <HomeSeoCard saved={SAVED} storeName="Ada Bıçak" />
    </QueryClientProvider>
  )

describe("HomeSeoCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    // As the server answers: the section with what was sent stored
    fetchMock.mockImplementation((_url: string, init?: { body?: Partial<SeoSettings> }) =>
      Promise.resolve({ values: { ...SAVED, ...init?.body } })
    )
  })

  it("saves only the home page's title and description, an emptied one as none", async () => {
    renderCard()
    const title = screen.getByRole("textbox", { name: "Sayfa başlığı" })
    const description = screen.getByRole("textbox", { name: "Açıklama" })
    expect(title).toHaveValue("")
    expect(title).toHaveAttribute("placeholder", "Ada Bıçak")
    expect(description).toHaveValue("Eski açıklama")

    await userEvent.type(title, "  El yapımı bıçaklar  ")
    await userEvent.clear(description)
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/seo", {
        method: "POST",
        body: { home: { title: "El yapımı bıçaklar", description: null } },
      })
    })
    // What the server stored, trimmed
    await waitFor(() => {
      expect(title).toHaveValue("El yapımı bıçaklar")
    })
    expect(description).toHaveValue("")
  })

  it("refuses a title longer than the server takes, sending nothing", async () => {
    renderCard()
    const title = screen.getByRole("textbox", { name: "Sayfa başlığı" })

    await userEvent.click(title)
    await userEvent.paste("a".repeat(151))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("En çok 150 karakter yazın.")
    expect(title).toHaveAttribute("aria-invalid", "true")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
