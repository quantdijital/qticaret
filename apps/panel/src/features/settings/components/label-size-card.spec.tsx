import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ShippingSettings } from "@/features/settings/api/sections"
import { LabelSizeCard } from "./label-size-card"

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
  packing_slip_prices: false,
  shipping_classes: [],
}

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LabelSizeCard saved={SAVED} />
    </QueryClientProvider>
  )

describe("LabelSizeCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    // As the server answers: the section with what was sent stored
    fetchMock.mockImplementation((_url: string, init?: { body?: Partial<ShippingSettings> }) =>
      Promise.resolve({ values: { ...SAVED, ...init?.body } })
    )
  })

  it("saves a custom roll size, and refuses one too small to print a label on", async () => {
    renderCard()
    expect(screen.getByText("100 × 150 mm, sayfada 1 etiket")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("combobox", { name: "Etiket boyutu" }))
    await userEvent.click(await screen.findByRole("option", { name: "Özel ölçü" }))
    const width = screen.getByRole("spinbutton", { name: "En (mm)" })
    const height = screen.getByRole("spinbutton", { name: "Boy (mm)" })
    await userEvent.clear(width)
    await userEvent.type(width, "50")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("En 70–210 mm")

    await userEvent.clear(width)
    await userEvent.type(width, "76")
    await userEvent.clear(height)
    await userEvent.type(height, "102")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/shipping", {
        method: "POST",
        body: {
          label_format: "custom",
          label_custom: { width_mm: 76, height_mm: 102 },
          packing_slip_prices: false,
        },
      })
    })
  })

  it("prints prices on the packing slip only when the shop turns them on", async () => {
    renderCard()
    const prices = screen.getByRole("switch", { name: "Paketleme fişinde fiyatları göster" })
    expect(prices).not.toBeChecked()

    await userEvent.click(prices)
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/shipping", {
        method: "POST",
        body: expect.objectContaining({ packing_slip_prices: true }) as unknown,
      })
    })
  })

  it("shows four labels to a sheet on A4", async () => {
    renderCard()

    await userEvent.click(screen.getByRole("combobox", { name: "Etiket boyutu" }))
    await userEvent.click(await screen.findByRole("option", { name: /^A4/ }))

    expect(screen.getByText("210 × 297 mm, sayfada 4 etiket")).toBeInTheDocument()
  })
})
