import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { SalePrices } from "@/features/products/api/sale-prices"
import { SalePriceField } from "./sale-price-field"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const read = (sale: SalePrices["variants"][number]["sale"]): SalePrices => ({
  currency_code: "try",
  variants: [{ id: "variant_1", regular: "100.00", sale }],
})

function renderField() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SalePriceField productId="prod_1" variantId="variant_1" idPrefix="single" />
    </QueryClientProvider>
  )
}

/** adr/0086: "İndirimli fiyat" beside the regular price, "Zamanla" for its days. */
describe("SalePriceField", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows the share off, refuses a sale not below the regular price, and saves with its days", async () => {
    fetchMock.mockImplementation((_url: string, init?: { method?: string }) =>
      Promise.resolve(
        init?.method === "POST"
          ? read({
              amount: "80.00",
              starts_at: null,
              ends_at: "2099-01-07T20:59:59.000Z",
              running: true,
            })
          : read(null)
      )
    )
    renderField()
    const field = await screen.findByLabelText("İndirimli fiyat")

    await userEvent.type(field, "100")
    expect(screen.getByText("İndirimli fiyat satış fiyatından düşük olmalı.")).toBeInTheDocument()

    await userEvent.clear(field)
    await userEvent.type(field, "80")
    expect(screen.getByText("%20 indirim")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Zamanla" }))
    await userEvent.type(screen.getByLabelText("Bitiş"), "2099-01-07")
    await userEvent.click(screen.getByRole("button", { name: "İndirimi kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/sale-prices", {
        method: "POST",
        body: {
          set: [
            {
              variant_id: "variant_1",
              amount: "80.00",
              starts_at: null,
              ends_at: "2099-01-07T20:59:59.000Z",
            },
          ],
        },
      })
    })
  })

  it("clears a stored sale when its price is removed", async () => {
    fetchMock.mockImplementation((_url: string, init?: { method?: string }) =>
      Promise.resolve(
        init?.method === "POST"
          ? read(null)
          : read({ amount: "80.00", starts_at: null, ends_at: null, running: true })
      )
    )
    renderField()
    expect(await screen.findByLabelText("İndirimli fiyat")).toHaveValue("80,00")
    expect(screen.getByText("İndirim sürüyor.")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "İndirimi kaldır" }))
    await userEvent.click(screen.getByRole("button", { name: "İndirimi kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/sale-prices", {
        method: "POST",
        body: { clear: ["variant_1"] },
      })
    })
  })
})
