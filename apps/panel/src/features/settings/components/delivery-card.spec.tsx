import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ShippingSettings } from "@/features/settings/api/sections"
import { DeliveryCard } from "./delivery-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

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

const MARKETING = "/admin/platform-settings/marketing"
const SHIPPING_URL = "/admin/platform-settings/shipping"

/** The backend: the marketing section with this legacy hour; a save answers what it stored. */
function backend(legacy: number | null) {
  fetchMock.mockImplementation(
    (url: string, init?: { method?: string; body?: Record<string, unknown> }) => {
      if (url === MARKETING && init?.method !== "POST") {
        return Promise.resolve({
          section: "marketing",
          values: { feed_same_day_cutoff_hour: legacy },
        })
      }
      if (url === SHIPPING_URL) {
        return Promise.resolve({ section: "shipping", values: { ...SHIPPING, ...init?.body } })
      }
      return Promise.resolve({ section: "marketing", values: { feed_same_day_cutoff_hour: null } })
    }
  )
}

function renderCard(saved: ShippingSettings = SHIPPING) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <DeliveryCard saved={saved} />
    </QueryClientProvider>
  )
}

const posts = (url: string) =>
  fetchMock.mock.calls.filter(
    ([called, init]) =>
      called === url && (init as { method?: string } | undefined)?.method === "POST"
  )

// adr/0046 Ek 2026-11-06: the same-day hour is set with the delivery days, under Kargo
describe("DeliveryCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("saves the days and the same-day hour the product pages and Akakçe show", async () => {
    backend(null)
    const user = userEvent.setup()
    renderCard()
    expect(
      screen.getByText(/ürün sayfalarındaki Kargo ve Teslimat kartında ve Akakçe'de/)
    ).toBeInTheDocument()
    await user.click(screen.getByRole("combobox", { name: "Aynı gün kargo saati" }))
    await user.click(await screen.findByRole("option", { name: "15:00 öncesi siparişler" }))
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        SHIPPING_URL,
        expect.objectContaining({
          method: "POST",
          body: {
            handling_days_min: 1,
            handling_days_max: 2,
            transit_days_min: 1,
            transit_days_max: 3,
            same_day_cutoff_hour: 15,
          },
        })
      )
    })
    // No old hour under the feed rules: nothing to clear there
    expect(posts(MARKETING)).toHaveLength(0)
  })

  it("shows the hour set under the feed rules before, and moves it here on save", async () => {
    backend(16)
    const user = userEvent.setup()
    renderCard()
    const hour = await screen.findByRole("combobox", { name: "Aynı gün kargo saati" })
    await waitFor(() => {
      expect(hour).toHaveTextContent("16:00 öncesi siparişler")
    })
    // The first "En çok": the days to get it out
    const [handlingMax] = screen.getAllByRole("spinbutton", { name: "En çok" })
    if (!handlingMax) {
      throw new Error("no days field")
    }
    await user.clear(handlingMax)
    await user.type(handlingMax, "3")
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        MARKETING,
        expect.objectContaining({ method: "POST", body: { feed_same_day_cutoff_hour: null } })
      )
    })
    expect(posts(SHIPPING_URL)[0]?.[1]).toMatchObject({
      body: { handling_days_max: 3, same_day_cutoff_hour: 16 },
    })
  })

  it("takes the hour off", async () => {
    backend(null)
    const user = userEvent.setup()
    renderCard({ ...SHIPPING, same_day_cutoff_hour: 14 })
    await user.click(screen.getByRole("combobox", { name: "Aynı gün kargo saati" }))
    await user.click(await screen.findByRole("option", { name: "Aynı gün kargo yok" }))
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(posts(SHIPPING_URL)[0]?.[1]).toMatchObject({ body: { same_day_cutoff_hour: null } })
    })
  })
})
