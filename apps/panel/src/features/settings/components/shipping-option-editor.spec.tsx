import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ShippingSettings } from "@/features/settings/api/sections"
import type { ShopShippingOption } from "@/features/settings/api/shipping-options"
import { RatesCard } from "./shipping-rules-cards"
import { ShippingOptionEditor } from "./shipping-option-editor"
import { ShippingOptionsCard } from "./shipping-options-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const wrap = (node: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

const SHIPPING: ShippingSettings = {
  handling_days_min: 1,
  handling_days_max: 2,
  transit_days_min: 1,
  transit_days_max: 3,
  same_day_cutoff_hour: null,
  rate_table: [],
  over_desi_price: 0,
  label_format: "100x150",
  label_custom: { width_mm: 100, height_mm: 150 },
  default_parcel: null,
  packing_slip_prices: false,
  shipping_classes: [],
}

const FAST: ShopShippingOption = {
  id: "so_fast",
  name: "Hızlı Kargo",
  carrier: "manual",
  pricing: "flat",
  amount: "150",
  in_store: false,
}

describe("shipping options, edited in their rows (F7.8)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({})
  })

  it("adds a flat option the shop ships itself, its name already filled in", async () => {
    wrap(<ShippingOptionEditor onDone={vi.fn()} />)

    expect(screen.getByLabelText(/^Ad/)).toHaveValue("Standart kargo")
    expect(screen.queryByRole("combobox", { name: "Ücret" })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/^Tutar/), "49,90")
    await userEvent.click(screen.getByRole("button", { name: "Ek seçenek ekle" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/shipping-setup/options", {
        method: "POST",
        body: {
          name: "Standart kargo",
          carrier: "manual",
          pricing: { type: "flat", amount: 49.9 },
        },
      })
    })
  })

  it("starts a Geliver option on its cheapest quote, with no amount asked", async () => {
    wrap(<ShippingOptionEditor carrier="geliver" onDone={vi.fn()} />)

    expect(screen.queryByLabelText(/^Tutar/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Ek seçenek ekle" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/shipping-setup/options", {
        method: "POST",
        body: {
          name: "Standart kargo",
          carrier: "geliver",
          pricing: { type: "quote", choice: "cheapest" },
        },
      })
    })
  })

  it("opens a row in place, reprices it, and removes it after a second press", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith("/options") ? { options: [FAST] } : {})
    )
    wrap(<ShippingOptionsCard options={[FAST]} custom={false} />)

    // Folded to a line: the extra options and their prices
    expect(screen.getByText(/Hızlı Kargo · ₺150,00/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Ek kargo seçenekleri" }))
    await userEvent.click(
      await screen.findByRole("button", { name: "Hızlı Kargo seçeneğini düzenle" })
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    const amount = screen.getByLabelText(/^Tutar/)
    await userEvent.clear(amount)
    await userEvent.type(amount, "120")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/shipping-setup/options/so_fast", {
        method: "POST",
        body: { name: "Hızlı Kargo", amount: 120 },
      })
    })

    await userEvent.click(screen.getByRole("button", { name: "Hızlı Kargo seçeneğini düzenle" }))
    await userEvent.click(screen.getByRole("button", { name: "Hızlı Kargo seçeneğini kaldır" }))
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/admin/shipping-setup/options/so_fast",
      expect.objectContaining({ method: "DELETE" })
    )
    await userEvent.click(screen.getByRole("button", { name: "Kaldır" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/shipping-setup/options/so_fast",
        expect.objectContaining({ method: "DELETE" })
      )
    })
  })

  it("saves the price table in kuruş, bands as typed", async () => {
    // As the server answers: the section with what was sent stored
    fetchMock.mockImplementation((_url: string, init?: { body?: Partial<ShippingSettings> }) =>
      Promise.resolve({ values: { ...SHIPPING, ...init?.body } })
    )
    wrap(<RatesCard saved={SHIPPING} />)

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
