import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BookingSlot } from "@/features/products/api/booking"
import { CATALOG, PRODUCT } from "./product-fixtures"
import { SummaryCard } from "./summary-card"

const fetchMock = vi.hoisted(() => vi.fn<(url: string) => Promise<unknown>>())
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const slot = (id: string, starts_at: string, available: number, status = "open"): BookingSlot =>
  ({
    id,
    starts_at,
    ends_at: null,
    status,
    capacity: 60,
    sold: 0,
    held: 0,
    available,
    price_adjustments: null,
  }) as BookingSlot

function renderCard(bookingMode: "none" | "departure", slots: BookingSlot[] = []) {
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith("/interest")) {
      return Promise.resolve({ wishlist: 3, stock_alerts: [] })
    }
    if (url.endsWith("/catalog")) {
      return Promise.resolve({ ...CATALOG, kind: "service", booking_mode: bookingMode })
    }
    if (url.endsWith("/booking-slots")) {
      return Promise.resolve({ slots })
    }
    if (url.includes("feature")) {
      return Promise.resolve({ features: [{ key: "catalog.booking", enabled: true }] })
    }
    return Promise.resolve({})
  })
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SummaryCard product={{ ...PRODUCT, created_at: "2026-11-01T09:00:00Z" }} />
    </QueryClientProvider>
  )
}

describe("the product's summary card", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-12-01T00:00:00Z") })
  })
  afterEach(() => {
    vi.useRealTimers()
    fetchMock.mockReset()
  })

  it("shows the stock and its waiting list for a product on a shelf, the dates on one line", async () => {
    renderCard("none")
    expect(await screen.findByText("Satılabilir stok")).toBeInTheDocument()
    expect(screen.getByText(/^Eklendi .+ · Değişti .+$/)).toBeInTheDocument()
    expect(screen.queryByText("Sıradaki kalkış")).toBeNull()
  })

  it("shows a dated product's next departure and the places left instead of stock", async () => {
    renderCard("departure", [
      slot("s_past", "2026-11-20T08:00:00Z", 10),
      slot("s_late", "2027-01-10T08:00:00Z", 40),
      slot("s_next", "2026-12-04T08:00:00Z", 25),
      slot("s_closed", "2026-12-02T08:00:00Z", 50, "closed"),
    ])
    expect(await screen.findByText("65 · 2 kalkış")).toBeInTheDocument()
    expect(screen.getByText("Sıradaki kalkış")).toBeInTheDocument()
    expect(screen.getByText(/4 Ara 2026/)).toBeInTheDocument()
    expect(screen.queryByText("Satılabilir stok")).toBeNull()
    expect(screen.queryByText("Stok bekleyen")).toBeNull()
  })

  it("says when a dated product has no departure ahead", async () => {
    renderCard("departure", [])
    expect(await screen.findByText("Planlı kalkış yok")).toBeInTheDocument()
    expect(screen.queryByText("Kalan yer")).toBeNull()
  })
})
