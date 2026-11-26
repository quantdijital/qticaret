import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { PromotionSettings } from "@/features/settings/api/sections"
import { FreeShippingCard } from "./free-shipping-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const URL = "/admin/platform-settings/promotions"

/** The backend: the promotions section with this threshold; a save answers what it stored. */
function backend(threshold: number | null) {
  let values: PromotionSettings = { combine_codes: false, free_shipping_threshold: threshold }
  fetchMock.mockImplementation((_url: string, init?: { method?: string; body?: object }) => {
    if (init?.method === "POST") {
      values = { ...values, ...init.body }
    }
    return Promise.resolve({ section: "promotions", values, version: 1 })
  })
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <FreeShippingCard />
    </QueryClientProvider>
  )
}

const posts = () =>
  fetchMock.mock.calls
    .filter(
      ([url, init]) => url === URL && (init as { method?: string } | undefined)?.method === "POST"
    )
    .map(([, init]) => (init as { body: unknown }).body)

// The owner, 2026-11-26: the threshold is set under Kargo, stored where it always was
describe("FreeShippingCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("says the threshold covers every option and saves a new amount", async () => {
    backend(1500)
    const user = userEvent.setup()
    renderCard()
    const field = await screen.findByLabelText("En az sepet tutarı")
    expect(screen.getByText(/bütün kargo seçenekleri ücretsiz olur/)).toBeInTheDocument()
    await user.clear(field)
    await user.type(field, "2000")
    await user.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(posts()).toEqual([{ free_shipping_threshold: 2000 }])
    })
  })

  it("turns free shipping off with null", async () => {
    backend(1500)
    const user = userEvent.setup()
    renderCard()
    await user.click(await screen.findByRole("switch"))
    expect(screen.queryByLabelText("En az sepet tutarı")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(posts()).toEqual([{ free_shipping_threshold: null }])
    })
  })

  it("asks for an amount before it saves one switched on", async () => {
    backend(null)
    const user = userEvent.setup()
    renderCard()
    await user.click(await screen.findByRole("switch"))
    const field = screen.getByLabelText("En az sepet tutarı")
    expect(field).not.toHaveAttribute("aria-invalid")
    await user.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByText(/0'dan büyük/)).toBeInTheDocument()
    expect(field).toHaveAttribute("aria-invalid", "true")
    expect(posts()).toEqual([])
  })
})
