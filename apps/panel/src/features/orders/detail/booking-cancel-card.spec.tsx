import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { OrderDeparture } from "@/features/orders/api/bookings"
import { BookingCancelCard } from "./booking-cancel-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const DEPARTURE: OrderDeparture = {
  slot_id: "bkslot_1",
  starts_at: "2099-05-02T06:00:00.000Z",
  timezone: "Europe/Istanbul",
  titles: ["Kapadokya turu"],
  cancelled: false,
  cancellable: true,
  refusal: null,
  days_before: 40,
  fee_percent: 20,
  paid: "1000",
  refund: "800",
  refund_within_days: null,
  manual: null,
}

function setup({ money = true, departures = [DEPARTURE] } = {}) {
  fetchMock.mockImplementation(
    (url: string, init?: { method?: string; query?: { mode?: string } }) => {
      if (url === "/admin/features") {
        return Promise.resolve({ features: [{ key: "catalog.booking", enabled: true }] })
      }
      if (url === "/admin/staff/me") {
        return Promise.resolve({ role: money ? "owner" : "operations", can: { money } })
      }
      if (init?.method === "POST") {
        return Promise.resolve({
          cancelled: true,
          refunded: "1000",
          refund_by_hand: "0",
          manual: null,
          order_cancelled: false,
        })
      }
      const full = init?.query?.mode === "full"
      return Promise.resolve({
        currency_code: "try",
        departures: departures.map((each) => (full ? { ...each, refund: each.paid } : each)),
      })
    }
  )
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <BookingCancelCard orderId="order_1" />
    </QueryClientProvider>
  )
}

describe("BookingCancelCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("previews the tier's refund, switches to all of it, and sends only the departure and the way", async () => {
    setup()
    await userEvent.click(await screen.findByRole("button", { name: "İptal et" }))
    const dialog = screen.getByRole("alertdialog", { name: "Rezervasyon iptal edilsin mi?" })
    expect(await within(dialog).findByText(/İade: ₺800,00 \(ödenen ₺1\.000,00\)/)).toBeVisible()
    await userEvent.click(within(dialog).getByRole("radio", { name: "Tamamını iade et" }))
    expect(await within(dialog).findByText(/İade: ₺1\.000,00/)).toBeVisible()
    await userEvent.click(within(dialog).getByRole("button", { name: "Rezervasyonu iptal et" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/bookings/cancel", {
        method: "POST",
        body: { slot_id: "bkslot_1", mode: "full" },
      })
    })
  })

  it("offers no cancel to a role that cannot give money back, and marks a cancelled departure", async () => {
    setup({
      money: false,
      departures: [DEPARTURE, { ...DEPARTURE, slot_id: "bkslot_2", cancelled: true }],
    })
    expect(await screen.findByText("İptal edildi")).toBeInTheDocument()
    expect(screen.getByText("Onaylı")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "İptal et" })).toBeNull()
  })

  it("says a bank transfer's refund is left to staff before the cancel (review O2)", async () => {
    setup({ departures: [{ ...DEPARTURE, manual: "offline" }] })
    await userEvent.click(await screen.findByRole("button", { name: "İptal et" }))
    const dialog = screen.getByRole("alertdialog", { name: "Rezervasyon iptal edilsin mi?" })
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Bu tutar kendiliğinden gönderilmez (havale ya da kapıda ödeme); iptalden sonra elle iade edin."
    )
  })

  it("is not drawn for an order without bookings", async () => {
    setup({ departures: [] })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/bookings", {
        query: { mode: "tier" },
      })
    })
    expect(screen.queryByText("Rezervasyonlar")).toBeNull()
  })
})
