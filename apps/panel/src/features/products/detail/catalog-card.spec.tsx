import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { i18next } from "@/lib/i18n"
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
  addons: [],
  description_doc: null,
  summary_doc: null,
  successor: null,
  categories: [],
  variants: [],
}

/** The card says what is saved; its fields are in the dialog "Düzenle" opens. */
async function openDialog() {
  await userEvent.click(await screen.findByRole("button", { name: "Katalog bilgileri: düzenle" }))
  return screen.getByRole("dialog", { name: "Katalog bilgileri" })
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
    await openDialog()
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
    // Saved, the dialog closes and the card says it
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    expect(screen.getByText("Dışında")).toBeInTheDocument()
  })

  it("explains the mark: a sealed good when physical, out outright when digital or a service", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CatalogCard productId="prod_1" />
      </QueryClientProvider>
    )
    await openDialog()
    const toggle = await screen.findByRole("switch", { name: "Cayma hakkı dışında" })

    expect(toggle).toHaveAccessibleDescription(
      /mühürlü ürün uyarısıdır \(MSY md\. 15\/1-ç\): iade talebi alınır, koruyucu ambalajı açılmış gelen teslim almada reddedilir/
    )
    expect(toggle).toHaveAccessibleDescription(
      /Dijital ürün ve hizmet ise cayma hakkı dışında kalır/
    )
    expect(toggle).toHaveAccessibleDescription(/Kişiye özel hazırlanan ürün \(md\. 15\/1-b\)/)
    expect(toggle).not.toHaveAccessibleDescription(/Hijyen ürünü ya da kişiye özel/)
  })

  it("cites 15/1-b for made-to-order goods in both languages, never 15/1-ç", () => {
    for (const lng of ["tr", "en"]) {
      const addon = i18next.t("products.addons.nonWithdrawableHint", { lng })
      const mark = i18next.t("products.catalog.withdrawalExcludedHint", { lng })
      expect(addon).toContain("15/1-b")
      expect(addon).not.toContain("15/1-ç")
      expect(mark).toContain("15/1-b")
      expect(mark).toContain("15/1-ç")
    }
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
    await openDialog()

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
    const renderCard = async () => {
      render(
        <QueryClientProvider client={new QueryClient()}>
          <CatalogCard productId="prod_1" />
        </QueryClientProvider>
      )
      await openDialog()
    }

    it("is not offered while the shop's gift cards are off", async () => {
      await renderCard()
      expect(await screen.findByRole("switch", { name: "Cayma hakkı dışında" })).toBeVisible()
      expect(screen.queryByRole("switch", { name: "Hediye kartı" })).toBeNull()
    })

    it("marks the product a gift card, sending only that, and says what it means", async () => {
      serve({})
      await renderCard()
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
      await renderCard()

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
      await renderCard()
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
