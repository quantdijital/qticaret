import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { i18next as i18n } from "@/lib/i18n"
import type { ShippingSettings } from "@/features/settings/api/sections"
import { advancedSummaries } from "@/features/settings/shipping-summaries"
import { CarrierInvoiceCard } from "./carrier-invoice-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const wrap = (node: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

const MANUAL = { title: "Örnek Mağaza", tax_id: "1234567890" }
const INVOICING = {
  provider: "none",
  trigger: "placed",
  carriers: { manual: MANUAL },
  series: null,
}

describe("a carrier's details on invoices, on its own page", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_url: string, init?: { body?: object }) =>
      Promise.resolve({ values: { ...INVOICING, ...init?.body } })
    )
  })

  it("saves this carrier's beside the others, which stay as they were", async () => {
    wrap(<CarrierInvoiceCard carrier="aras" />)

    await userEvent.type(await screen.findByLabelText("Unvan"), "Örnek Kargo A.Ş.")
    await userEvent.type(screen.getByLabelText("VKN"), "1111111111")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/invoicing", {
        method: "POST",
        body: {
          carriers: {
            manual: MANUAL,
            aras: { title: "Örnek Kargo A.Ş.", tax_id: "1111111111" },
          },
        },
      })
    })
  })

  it("asks for the tax id with the name, and refuses one of the wrong length", async () => {
    wrap(<CarrierInvoiceCard carrier="yurtici" />)

    await userEvent.type(await screen.findByLabelText("Unvan"), "Örnek Kargo")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByText(/birlikte girin/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("VKN"), "123")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByText(/10, TCKN 11/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/admin/platform-settings/invoicing",
      expect.anything()
    )
  })
})

describe("the folded shipping settings' one-line summaries", () => {
  const saved: ShippingSettings = {
    handling_days_min: 1,
    handling_days_max: 2,
    transit_days_min: 3,
    transit_days_max: 3,
    same_day_cutoff_hour: 14,
    rate_table: [
      { max_desi: 5, price: 5_000 },
      { max_desi: 30.5, price: 15_000 },
    ],
    over_desi_price: 0,
    label_format: "custom",
    label_custom: { width_mm: 90, height_mm: 120 },
    default_parcel: { weight: 500, length: 20, width: 15, height: 5 },
    packing_slip_prices: false,
    shipping_classes: [],
  }

  it("say what each holds now", () => {
    const lines = advancedSummaries(i18n.t, saved, { weight: "g", dimension: "cm" })
    expect(lines.delivery).toBe("Kargoya verme 1–2 gün · taşıma 3 gün · 14:00 öncesi aynı gün")
    expect(lines.rates).toBe("2 satır, 30,5 desiye kadar")
    expect(lines.parcel).toBe("500 g · 20 × 15 × 5 cm")
    expect(lines.label).toBe("90 × 120 mm")
  })

  it("name the platform's defaults while the shop keeps them", () => {
    const lines = advancedSummaries(
      i18n.t,
      { ...saved, rate_table: [], default_parcel: null, label_format: "100x150" },
      { weight: "g", dimension: "cm" }
    )
    expect(lines.rates).toMatch(/^Satır yok/)
    expect(lines.parcel).toBe("Platform paketi: 1 kg, 30 × 20 × 10 cm (2 desi)")
    expect(lines.label).toBe("100 × 150 mm (termal, en yaygın)")
  })
})
