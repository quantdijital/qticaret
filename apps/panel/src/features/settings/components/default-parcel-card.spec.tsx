import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ShippingSettings, StoreSettings } from "@/features/settings/api/sections"
import { DefaultParcelCard } from "./default-parcel-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const SAVED: ShippingSettings = {
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
}

const STORE = { weight_unit: "g", dimension_unit: "cm" } as StoreSettings

function renderCard(saved: ShippingSettings, store: StoreSettings = STORE) {
  fetchMock.mockImplementation((url: string, init?: { body?: Partial<ShippingSettings> }) =>
    Promise.resolve(
      url.endsWith("/store")
        ? { section: "store", values: store, version: 1 }
        : { section: "shipping", values: { ...saved, ...init?.body }, version: 2 }
    )
  )
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <DefaultParcelCard saved={saved} />
    </QueryClientProvider>
  )
}

const input = (name: string) => screen.getByRole("spinbutton", { name })

describe("DefaultParcelCard (adr/0054)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows the platform's parcel until the shop saves its own, and saves all four", async () => {
    renderCard(SAVED)

    expect(screen.getByText(/kargo firması gerçek paketi kendisi ölçer/)).toBeInTheDocument()
    expect(input("Ağırlık")).toHaveValue("1000")
    expect(input("Uzunluk")).toHaveValue("30")
    expect(screen.getByText(/2 desiden hesaplanır/)).toBeInTheDocument()
    expect(screen.getByText(/Platformun önerdiği paket/)).toBeInTheDocument()

    await userEvent.clear(input("Ağırlık"))
    await userEvent.type(input("Ağırlık"), "2500,5")
    expect(screen.getByText(/2,6 desiden hesaplanır/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/shipping", {
        method: "POST",
        body: { default_parcel: { weight: 2500.5, length: 30, width: 20, height: 10 } },
      })
    })
  })

  it("reads the shop's own parcel in its units, and refuses a value at zero", async () => {
    renderCard(
      { ...SAVED, default_parcel: { weight: 1.5, length: 400, width: 300, height: 200 } },
      { ...STORE, weight_unit: "kg", dimension_unit: "mm" }
    )

    await waitFor(() => {
      expect(screen.getAllByText("kg")).toHaveLength(1)
    })
    expect(input("Ağırlık")).toHaveValue("1,5")
    expect(screen.getByText(/8 desiden hesaplanır/)).toBeInTheDocument()
    expect(screen.queryByText(/Platformun önerdiği paket/)).not.toBeInTheDocument()

    await userEvent.clear(input("Yükseklik"))
    await userEvent.type(input("Yükseklik"), "0")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("sıfırdan büyük")
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/admin/platform-settings/shipping",
      expect.anything()
    )
  })
})
