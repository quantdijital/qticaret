import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ShippingSettings } from "@/features/settings/api/sections"
import type { ShopShippingOption } from "@/features/settings/api/shipping-options"
import { ShippingFeeSection } from "./shipping-fee-section"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const option = (id: string, name: string, amount: string): ShopShippingOption => ({
  id,
  name,
  carrier: "manual",
  pricing: "flat",
  amount,
  in_store: true,
})

const SAVED = {
  rate_table: [],
  shipping_classes: [],
  primary_option_id: null,
} as unknown as ShippingSettings

/** The dev shop: Standart ₺90 and Hızlı ₺150, free from ₺1.500. */
function backend(threshold: number | null) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    if (url === "/admin/shipping-setup/options" && !init?.method) {
      return Promise.resolve({
        options: [
          option("so_1", "Hızlı Kargo", "150.00"),
          option("so_2", "Standart Kargo", "90.00"),
        ],
      })
    }
    if (url.endsWith("/promotions")) {
      return Promise.resolve({
        section: "promotions",
        version: 1,
        values: { combine_codes: false, free_shipping_threshold: threshold },
      })
    }
    if (url.includes("payments") || url.includes("provider")) {
      return Promise.resolve({ accounts: [] })
    }
    return Promise.resolve({ id: "so_new", values: SAVED, usage: {} })
  })
}

const renderSection = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ShippingFeeSection saved={SAVED} />
    </QueryClientProvider>
  )

const posts = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method)

describe("ShippingFeeSection: the fee as one question", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("reads a flat fee and a threshold as free above an amount, the main option kept apart", async () => {
    backend(1500)
    renderSection()

    const chosen = await screen.findByRole("radio", { name: /Belli tutarın üstünde ücretsiz/ })
    expect(chosen).toBeChecked()
    expect(screen.getByLabelText(/^Ücretsiz kargo sınırı/)).toHaveValue("1.500,00")
    expect(screen.getByLabelText(/^Sınırın altında kargo ücreti/)).toHaveValue("90,00")
    expect(screen.getByTestId("shipping-fee-primary")).toHaveTextContent("Standart Kargo")
    // The extras: Hızlı Kargo only, folded to its line
    expect(screen.getByText("Hızlı Kargo · ₺150,00")).toBeInTheDocument()
  })

  it("saves free for every order as the main option at 0 TL and no threshold", async () => {
    backend(1500)
    renderSection()

    await userEvent.click(
      await screen.findByRole("radio", { name: /Tüm siparişlerde kargo ücretsiz/ })
    )
    const card = screen.getByRole("radiogroup").closest("form") ?? document.body
    await userEvent.click(within(card).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(posts()).toHaveLength(3)
    })
    expect(posts()).toEqual([
      ["/admin/shipping-setup/options/so_2", { method: "POST", body: { amount: 0 } }],
      [
        "/admin/platform-settings/promotions",
        { method: "POST", body: { free_shipping_threshold: null } },
      ],
      [
        "/admin/platform-settings/shipping",
        { method: "POST", body: { primary_option_id: "so_2" } },
      ],
    ])
  })

  it("asks for the fee of a flat answer before saving", async () => {
    backend(null)
    renderSection()

    expect(await screen.findByRole("radio", { name: /^Sabit ücret/ })).toBeChecked()
    const fee = screen.getByLabelText(/^Sipariş başına kargo ücreti/)
    await userEvent.clear(fee)
    const card = screen.getByRole("radiogroup").closest("form") ?? document.body
    await userEvent.click(within(card).getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByText(/en çok 100.000 TL/)).toBeInTheDocument()
    expect(posts()).toHaveLength(0)
  })
})
