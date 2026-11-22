import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY } from "@/features/auth/api/staff"
import type { BookingSlot, SlotBooking } from "@/features/products/api/booking"
import { SlotBookingsDialog } from "./slot-bookings-dialog"
import { SHOWN_FOR_MS } from "./slot-travelers"
import { birthDateText, printedTravelers, whenOf } from "./traveler-text"

const fetchMock = vi.hoisted(() => vi.fn())
const openMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params: { id: string } }) => (
    <a href={`/orders/${params.id}`}>{children}</a>
  ),
}))

const SLOT: BookingSlot = {
  id: "bkslot_1",
  starts_at: "2099-05-02T06:00:00.000Z",
  ends_at: null,
  status: "open",
  capacity: 20,
  sold: 2,
  held: 0,
  available: 18,
  price_adjustments: null,
}

const BOOKING: SlotBooking = {
  id: "bkng_1",
  order_id: "order_1",
  display_id: 1042,
  units: 2,
  status: "confirmed",
  created_at: "2099-04-01T10:00:00.000Z",
  travelers: [
    {
      id: "bktrv_1",
      position: 0,
      first_name: "Ayşe",
      last_name: "Yılmaz",
      birth_date: "1990-01-15",
      nationality: "TR",
      document_masked: "***5678",
    },
    {
      id: "bktrv_2",
      position: 1,
      first_name: "Ali",
      last_name: "Kaya",
      birth_date: null,
      nationality: null,
      document_masked: null,
    },
  ],
}

function setup(travelerDocuments: boolean, bookings: SlotBooking[] = [BOOKING]) {
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      url.endsWith("/reveal") ? { id: "bktrv_1", document_no: "U12345678" } : { bookings }
    )
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(STAFF_KEY, {
    user_id: "user_1",
    role: travelerDocuments ? "admin" : "operations",
    can: { travelerDocuments },
  })
  render(
    <QueryClientProvider client={client}>
      <SlotBookingsDialog slot={SLOT} zone="Europe/Istanbul" onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

describe("a departure's travelers (adr/0076 Ek D6b)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("open", openMock)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("lists each booking's travelers under it, the number masked", async () => {
    setup(false)
    const dialog = await screen.findByRole("dialog", { name: "Katılımcılar" })
    const list = await within(dialog).findByRole("list", { name: "Katılımcılar" })
    expect(within(list).getByText("Ayşe Yılmaz")).toBeInTheDocument()
    expect(within(list).getByText("15.01.1990 · Türkiye")).toBeInTheDocument()
    expect(within(list).getByText("***5678")).toBeInTheDocument()
    expect(within(list).getByText("Ali Kaya")).toBeInTheDocument()
    // Operations and read-only see the number masked only
    expect(within(dialog).queryByRole("button", { name: "Numarayı göster" })).toBeNull()
  })

  it("shows the full number to owner and admin, then masks it again after a while", async () => {
    setup(true)
    const dialog = await screen.findByRole("dialog", { name: "Katılımcılar" })
    // Only the traveler with a number has the button
    const buttons = await within(dialog).findAllByRole("button", { name: "Numarayı göster" })
    expect(buttons).toHaveLength(1)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fireEvent.click(within(dialog).getByRole("button", { name: "Numarayı göster" }))
    expect(await within(dialog).findByText("U12345678")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/booking-travelers/bktrv_1/reveal", {
      method: "POST",
      body: {},
    })
    act(() => {
      vi.advanceTimersByTime(SHOWN_FOR_MS)
    })
    expect(within(dialog).queryByText("U12345678")).toBeNull()
    expect(within(dialog).getByText("***5678")).toBeInTheDocument()
  })

  it("hides the number at once on Gizle", async () => {
    setup(true)
    const dialog = await screen.findByRole("dialog", { name: "Katılımcılar" })
    fireEvent.click(await within(dialog).findByRole("button", { name: "Numarayı göster" }))
    fireEvent.click(await within(dialog).findByRole("button", { name: "Gizle" }))
    await waitFor(() => {
      expect(within(dialog).queryByText("U12345678")).toBeNull()
    })
  })

  it("opens the printable list on a page of its own", async () => {
    setup(false)
    const dialog = await screen.findByRole("dialog", { name: "Katılımcılar" })
    fireEvent.click(
      await within(dialog).findByRole("button", { name: "Katılımcı listesini yazdır" })
    )
    expect(openMock).toHaveBeenCalledWith(
      "/print/departure?slot=bkslot_1&zone=Europe%2FIstanbul&at=2099-05-02T06%3A00%3A00.000Z",
      "_blank",
      "noopener"
    )
  })

  it("offers no print for an older backend's bookings without travelers", async () => {
    const plain: SlotBooking = { ...BOOKING }
    delete plain.travelers
    setup(false, [plain])
    const dialog = await screen.findByRole("dialog", { name: "Katılımcılar" })
    await within(dialog).findByRole("link", { name: "#1042" })
    expect(within(dialog).queryByRole("button", { name: "Katılımcı listesini yazdır" })).toBeNull()
  })
})

describe("the printed list's words", () => {
  it("leaves a cancelled booking's travelers off and keeps the order's number", () => {
    const rows = printedTravelers([BOOKING, { ...BOOKING, id: "bkng_2", status: "cancelled" }])
    expect(rows.map((row) => [row.first_name, row.display_id])).toEqual([
      ["Ayşe", 1042],
      ["Ali", 1042],
    ])
  })

  it("says nothing for a hand-typed date or zone, and keeps an odd birth date as it is", () => {
    expect(whenOf("not a date", "Europe/Istanbul", "tr")).toBe("")
    expect(whenOf("2099-05-02T06:00:00.000Z", "Nowhere/Land", "tr")).toBe("")
    expect(whenOf(undefined, undefined, "tr")).toBe("")
    expect(birthDateText("15/01/1990", "tr")).toBe("15/01/1990")
  })
})
