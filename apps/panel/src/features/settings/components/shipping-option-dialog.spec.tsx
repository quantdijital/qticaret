import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { RatesCard } from "./shipping-rules-cards"
import { ShippingOptionDialog } from "./shipping-option-dialog"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const wrap = (node: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

describe("shipping settings (F7.8)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({})
  })

  it("adds a flat option the shop ships itself, in lira", async () => {
    wrap(<ShippingOptionDialog open onOpenChange={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/^Ad/), "Standart Kargo")
    await userEvent.click(screen.getByRole("combobox", { name: "Taşıyan" }))
    await userEvent.click(screen.getByRole("option", { name: "Kendi gönderimim" }))
    await userEvent.type(screen.getByLabelText(/Ücret \(TL\)/), "49,90")
    await userEvent.click(screen.getByRole("button", { name: "Seçenek ekle" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/shipping-setup/options", {
        method: "POST",
        body: {
          name: "Standart Kargo",
          carrier: "manual",
          pricing: { type: "flat", amount: 49.9 },
        },
      })
    })
  })

  it("adds a Geliver option priced by the table, with no amount asked", async () => {
    wrap(<ShippingOptionDialog open onOpenChange={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/^Ad/), "Ekonomik")
    await userEvent.click(screen.getByRole("combobox", { name: "Ücret" }))
    await userEvent.click(screen.getByRole("option", { name: "Ücret tablosu (desi)" }))
    expect(screen.queryByLabelText(/Ücret \(TL\)/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Seçenek ekle" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/shipping-setup/options", {
        method: "POST",
        body: { name: "Ekonomik", carrier: "geliver", pricing: { type: "table" } },
      })
    })
  })

  it("saves the price table in kuruş, bands as typed", async () => {
    wrap(
      <RatesCard
        saved={{
          handling_days_min: 1,
          handling_days_max: 2,
          transit_days_min: 1,
          transit_days_max: 3,
          rate_table: [],
          over_desi_price: 0,
        }}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "Satır ekle" }))
    await userEvent.type(screen.getByLabelText("1. satırın desi sınırı"), "2,5")
    await userEvent.type(screen.getByLabelText("1. satırın ücreti"), "49,90")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/shipping", {
        method: "POST",
        body: { rate_table: [{ max_desi: 2.5, price: 4_990 }], over_desi_price: 0 },
      })
    })
  })
})
