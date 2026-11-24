import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductBadgeSettings } from "@/features/settings/api/product-badges"
import { ProductBadgesCard } from "./product-badges-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const OFF: ProductBadgeSettings = {
  manual_enabled: false,
  new_enabled: false,
  new_days: 30,
  best_seller_enabled: false,
  best_seller_min_units: 10,
}

describe("ProductBadgesCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_url: string, init?: { body?: Partial<ProductBadgeSettings> }) =>
      Promise.resolve({
        section: "product_badges",
        version: 1,
        values: { ...OFF, ...init?.body },
      })
    )
  })

  function renderCard() {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProductBadgesCard />
      </QueryClientProvider>
    )
  }

  it("shows each badge off at first, its number hidden until it is on", async () => {
    renderCard()
    for (const name of ["Ürünün kendi rozeti", "Çok satan", "Yeni"]) {
      expect(await screen.findByRole("switch", { name })).not.toBeChecked()
    }
    expect(screen.queryByLabelText("Gün")).toBeNull()
    expect(screen.queryByLabelText("Satış adedi (30 gün)")).toBeNull()
  })

  it("turns best seller on with its least units and saves the section", async () => {
    renderCard()
    await userEvent.click(await screen.findByRole("switch", { name: "Çok satan" }))
    const least = await screen.findByLabelText("Satış adedi (30 gün)")
    await userEvent.clear(least)
    await userEvent.type(least, "5")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/platform-settings/product_badges",
        expect.objectContaining({
          method: "POST",
          body: { ...OFF, best_seller_enabled: true, best_seller_min_units: 5 },
        })
      )
    })
  })

  it("refuses a day count out of range", async () => {
    renderCard()
    await userEvent.click(await screen.findByRole("switch", { name: "Yeni" }))
    const days = await screen.findByLabelText("Gün")
    await userEvent.clear(days)
    await userEvent.type(days, "0")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByText("Geçerli bir sayı girin.")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/admin/platform-settings/product_badges",
      expect.objectContaining({ method: "POST" })
    )
  })
})
