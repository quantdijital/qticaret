import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import { CatalogCard } from "./catalog-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// Links as plain anchors: the card is rendered without a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

const CATALOG: ProductCatalog = {
  condition: "new",
  kind: "physical",
  primary_category_id: null,
  withdrawal_excluded: false,
  restriction: null,
  is_gift_card: false,
  successor: null,
  categories: [],
  variants: [],
}

describe("CatalogCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string, init?: { body?: Partial<ProductCatalog> }) =>
      Promise.resolve(url.includes("/catalog") ? { ...CATALOG, ...init?.body } : { features: [] })
    )
  })

  it("marks a product outside the right of withdrawal, sending only that", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CatalogCard productId="prod_1" />
      </QueryClientProvider>
    )
    const toggle = await screen.findByRole("switch", { name: "Cayma hakkı dışında" })
    expect(toggle).not.toBeChecked()

    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog", {
        method: "POST",
        body: { withdrawal_excluded: true },
      })
    })
  })

  it("offers the age limit once the shop sells to adults only, sending the reason", async () => {
    fetchMock.mockImplementation((url: string, init?: { body?: Partial<ProductCatalog> }) =>
      Promise.resolve(
        url.includes("/catalog")
          ? { ...CATALOG, ...init?.body }
          : { features: [{ key: "catalog.restricted", enabled: true }] }
      )
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CatalogCard productId="prod_1" />
      </QueryClientProvider>
    )

    await userEvent.click(await screen.findByRole("combobox", { name: "Yaş sınırı" }))
    await userEvent.click(await screen.findByRole("option", { name: "Silah ve kesici alet" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog", {
        method: "POST",
        body: { restriction: "weapon" },
      })
    })
  })

  describe("gift card", () => {
    const GIFT_CARDS_ON = { features: [{ key: "promotions.gift_cards", enabled: true }] }
    const serve = (catalog: Partial<ProductCatalog>, post?: () => Promise<unknown>) => {
      fetchMock.mockImplementation(
        (url: string, init?: { method?: string; body?: Partial<ProductCatalog> }) => {
          if (!url.includes("/catalog")) {
            return Promise.resolve(GIFT_CARDS_ON)
          }
          if (init?.method === "POST" && post) {
            return post()
          }
          return Promise.resolve({ ...CATALOG, ...catalog, ...init?.body })
        }
      )
    }
    const renderCard = () =>
      render(
        <QueryClientProvider client={new QueryClient()}>
          <CatalogCard productId="prod_1" />
        </QueryClientProvider>
      )

    it("is not offered while the shop's gift cards are off", async () => {
      renderCard()
      expect(await screen.findByRole("switch", { name: "Cayma hakkı dışında" })).toBeVisible()
      expect(screen.queryByRole("switch", { name: "Hediye kartı" })).toBeNull()
    })

    it("marks the product a gift card, sending only that, and says what it means", async () => {
      serve({})
      renderCard()
      const toggle = await screen.findByRole("switch", { name: "Hediye kartı" })
      expect(toggle).toHaveAccessibleDescription(/Varyantlar kartın tutarlarıdır/)
      expect(toggle).toHaveAccessibleDescription(/stok takibini kapatmanız önerilir/)

      await userEvent.click(toggle)
      await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog", {
          method: "POST",
          body: { is_gift_card: true },
        })
      })
    })

    it("says why marking was refused, with where to turn gift cards on", async () => {
      const message =
        "Hediye kartı satmak için önce Ayarlar > Özellikler'den hediye kartlarını açın."
      serve({}, () => Promise.reject(Object.assign(new Error(message), { status: 400 })))
      renderCard()

      await userEvent.click(await screen.findByRole("switch", { name: "Hediye kartı" }))
      await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

      const alert = await screen.findByRole("alert")
      expect(alert).toHaveTextContent(message)
      expect(within(alert).getByRole("link", { name: "Özelliklere git" })).toHaveAttribute(
        "href",
        "/settings/features"
      )
    })

    it("locks a gift card's kind to digital, and unmarks it", async () => {
      serve({ is_gift_card: true, kind: "digital" })
      renderCard()
      const toggle = await screen.findByRole("switch", { name: "Hediye kartı" })
      expect(toggle).toBeChecked()
      const kind = screen.getByRole("combobox", { name: "Ürün türü" })
      expect(kind).toBeDisabled()
      expect(kind).toHaveTextContent("Dijital ürün")

      await userEvent.click(toggle)
      expect(kind).toBeEnabled()
      await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog", {
          method: "POST",
          body: { is_gift_card: false },
        })
      })
    })
  })
})
