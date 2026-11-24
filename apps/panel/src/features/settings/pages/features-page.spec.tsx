import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { FeatureState } from "@/features/settings/api/features"
import { FeaturesPage } from "./features-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

const FLAGS: FeatureState[] = [
  { key: "catalog.non_physical", default: false, owner: "tenant", enabled: false },
  { key: "catalog.booking", default: false, owner: "tenant", enabled: true },
  { key: "catalog.product_videos", default: true, owner: "platform", enabled: true },
  { key: "payments.cash_on_delivery", default: false, owner: "tenant", enabled: false },
  { key: "seo.publish_gate", default: false, owner: "tenant", enabled: false },
  { key: "ai.reviews", default: false, owner: "tenant", enabled: false },
]

function serve(features: FeatureState[] = FLAGS) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) =>
    Promise.resolve(init?.method === "POST" ? { feature: features[0] } : { features })
  )
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <FeaturesPage />
    </QueryClientProvider>
  )
}

function card(title: string): HTMLElement {
  const section = screen.getByRole("heading", { name: title }).closest("section")
  if (!section) {
    throw new Error(`no card ${title}`)
  }
  return section
}

describe("FeaturesPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows the flags in cards by area", async () => {
    serve()
    renderPage()
    await screen.findByRole("heading", { name: "Katalog ve ürün" })
    expect(
      within(card("Katalog ve ürün")).getByRole("switch", { name: "Tarihli ürünler" })
    ).toBeChecked()
    expect(
      within(card("Satış ve ödeme")).getByRole("switch", { name: "Kapıda ödeme" })
    ).toBeInTheDocument()
    expect(within(card("Arama motorları (SEO)")).getAllByRole("switch")).toHaveLength(1)
    expect(within(card("Yapay zekâ")).getAllByRole("switch")).toHaveLength(1)
    // No flag of these areas, no card
    expect(screen.queryByRole("heading", { name: "Yaş sınırlı ürünler" })).toBeNull()
  })

  it("a line per flag, the full words behind the (i)", async () => {
    serve()
    renderPage()
    const toggle = await screen.findByRole("switch", { name: "Kapıda ödeme" })
    expect(screen.getByText("Müşteri ödemeyi teslimatta kuryeye yapar.")).toBeVisible()
    expect(toggle).toHaveAccessibleDescription(/Ayarlar > Ödeme > Kapıda ödeme/)
    expect(screen.getByRole("button", { name: "Bilgi: Kapıda ödeme" })).toBeInTheDocument()
  })

  it("a plan flag stays visible, locked, with its reason", async () => {
    serve()
    renderPage()
    const videos = await screen.findByRole("switch", { name: "Ürün videoları" })
    expect(videos).toBeDisabled()
    const row = videos.closest("li") as HTMLElement
    expect(within(row).getByText("Paketinizde")).toBeInTheDocument()
    expect(within(row).getByText(/buradan değiştirilemez/)).toBeInTheDocument()
  })

  it("warns when a flag needs one that is off", async () => {
    serve()
    renderPage()
    const booking = await screen.findByRole("switch", { name: "Tarihli ürünler" })
    expect(
      within(booking.closest("li") as HTMLElement).getByText(
        /“Dijital ve hizmet ürünleri” özelliğinin de açık/
      )
    ).toBeInTheDocument()
  })

  it("a search narrows every card", async () => {
    serve()
    renderPage()
    await screen.findByRole("switch", { name: "Kapıda ödeme" })
    fireEvent.change(screen.getByRole("searchbox", { name: "Özellik ara" }), {
      target: { value: "KAPIDA" },
    })
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Katalog ve ürün" })).toBeNull()
    })
    expect(screen.getAllByRole("switch")).toHaveLength(1)
    expect(screen.getByRole("switch", { name: "Kapıda ödeme" })).toBeInTheDocument()

    fireEvent.change(screen.getByRole("searchbox", { name: "Özellik ara" }), {
      target: { value: "bulunmayan" },
    })
    expect(await screen.findByText("Aramanızla eşleşen özellik yok.")).toBeInTheDocument()
  })

  it("a switch sets the flag through the same route", async () => {
    serve()
    renderPage()
    fireEvent.click(await screen.findByRole("switch", { name: "Kapıda ödeme" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/features/payments.cash_on_delivery", {
        method: "POST",
        body: { enabled: true },
      })
    })
  })

  it("search in the shopper's words asks first before it goes on (adr/0077 §7)", async () => {
    serve([
      ...FLAGS,
      { key: "ai.storefront_search", default: false, owner: "tenant", enabled: false },
    ])
    renderPage()
    fireEvent.click(await screen.findByRole("switch", { name: "Kendi cümlesiyle arama" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/ad ve adres her zaman ayıklanamaz/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/admin/features/ai.storefront_search",
      expect.anything()
    )
    fireEvent.click(within(dialog).getByRole("button", { name: "Aç" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/features/ai.storefront_search", {
        method: "POST",
        body: { enabled: true },
      })
    })
  })

  it("no flags: the empty note, no search", async () => {
    serve([])
    renderPage()
    expect(await screen.findByText(/Şu an açıp kapatılabilecek/)).toBeInTheDocument()
    expect(screen.queryByRole("searchbox")).toBeNull()
  })
})
