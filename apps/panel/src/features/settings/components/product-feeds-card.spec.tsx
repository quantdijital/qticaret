import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { ProductFeedsCard } from "./product-feeds-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const ON = {
  enabled: true,
  storefront_set: true,
  targets: [
    {
      target: "google",
      url: "https://api.magaza.example/feeds/abc/google",
      item_count: 42,
      generated_at: new Date().toISOString(),
    },
    {
      target: "meta",
      url: "https://api.magaza.example/feeds/abc/meta",
      item_count: null,
      generated_at: null,
    },
  ],
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ProductFeedsCard />
    </QueryClientProvider>
  )
}

describe("ProductFeedsCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("turns the feeds on", async () => {
    fetchMock.mockResolvedValue({ feeds: { enabled: false, targets: [] } })
    renderCard()
    await userEvent.click(await screen.findByRole("button", { name: "Feed'leri aç" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/marketing-feeds/token", { method: "POST" })
    })
  })

  it("shows each address to copy, and asks before giving them new ones", async () => {
    fetchMock.mockResolvedValue({ feeds: ON })
    renderCard()

    expect(
      await screen.findByDisplayValue("https://api.magaza.example/feeds/abc/google")
    ).toBeInTheDocument()
    expect(screen.getByText(/42 ürün/)).toBeInTheDocument()
    expect(screen.getByText(/İlk feed hazırlanıyor/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Adresi yenile" }))
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/marketing-feeds/token", expect.anything())
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Adresi yenile" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/marketing-feeds/token", { method: "POST" })
    })
  })
})
