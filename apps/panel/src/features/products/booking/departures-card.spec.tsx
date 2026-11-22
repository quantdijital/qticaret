import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BookingSlot } from "@/features/products/api/booking"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import { DeparturesCard } from "./departures-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params: { id: string } }) => (
    <a href={`/orders/${params.id}`}>{children}</a>
  ),
}))

const CATALOG: ProductCatalog = {
  condition: "new",
  kind: "service",
  booking_mode: "departure",
  primary_category_id: null,
  withdrawal_excluded: false,
  restriction: null,
  is_gift_card: false,
  addons: [],
  description_doc: null,
  summary_doc: null,
  successor: null,
  categories: [],
  variants: [
    { id: "variant_adult", title: "Yetişkin", sku: null, mpn: null, cost: null, gtin: null },
  ],
}

const SLOT: BookingSlot = {
  id: "bkslot_1",
  starts_at: "2099-05-02T06:00:00.000Z",
  ends_at: null,
  status: "open",
  capacity: 20,
  sold: 3,
  held: 2,
  available: 15,
  price_adjustments: null,
}

interface Setup {
  flag?: boolean
  catalog?: Partial<ProductCatalog>
  slots?: BookingSlot[]
  refuse?: Record<string, unknown>
  money?: boolean
}

function setup({ flag = true, catalog = {}, slots = [SLOT], refuse, money = true }: Setup = {}) {
  fetchMock.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
    if (url === "/admin/features") {
      return Promise.resolve({ features: [{ key: "catalog.booking", enabled: flag }] })
    }
    if (url.endsWith("/catalog")) {
      return Promise.resolve({ ...CATALOG, ...catalog })
    }
    if (url.endsWith("/bookable")) {
      return Promise.resolve({ booking_mode: "departure", bookable: null })
    }
    if (url === "/admin/staff/me") {
      return Promise.resolve({ role: money ? "admin" : "operations", can: { money } })
    }
    if (url.endsWith("/cancel")) {
      return Promise.resolve({
        preview: {
          slot_id: "bkslot_1",
          status: "open",
          bookings: 2,
          orders: 2,
          units: 3,
          refund: "4500",
          refund_by_hand: "900",
          by_hand_orders: 1,
          partial: false,
        },
      })
    }
    if (url.endsWith("/bookings")) {
      return Promise.resolve({
        bookings: [
          {
            id: "bkng_1",
            order_id: "order_1",
            display_id: 1042,
            units: 3,
            status: "confirmed",
            created_at: "2099-04-01T10:00:00.000Z",
          },
        ],
      })
    }
    if (init?.method === "POST") {
      return refuse
        ? Promise.reject(Object.assign(new Error("refused"), refuse))
        : Promise.resolve({ slots: [SLOT], slot: SLOT })
    }
    return Promise.resolve({ slots })
  })
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <DeparturesCard productId="prod_1" />
    </QueryClientProvider>
  )
}

const posts = () =>
  fetchMock.mock.calls.filter(
    ([, init]) => (init as { method?: string } | undefined)?.method === "POST"
  )

describe("DeparturesCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("lists the departures with their places on the product's clock", async () => {
    setup()
    const row = (await screen.findByText(/2 May 2099/)).closest("tr")
    expect(row).not.toBeNull()
    const cells = within(row as HTMLElement).getAllByRole("cell")
    expect(cells.slice(1, 5).map((cell) => cell.textContent)).toEqual(["20", "3", "2", "15"])
    expect(within(row as HTMLElement).getByText("09:00", { exact: false })).toBeInTheDocument()
    expect(within(row as HTMLElement).getByText("Satışta")).toBeInTheDocument()
  })

  it("is not drawn while the flag is off or the product is not sold by departure", async () => {
    setup({ flag: false })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/features")
    })
    expect(screen.queryByText("Tarihler ve kontenjan")).toBeNull()

    fetchMock.mockReset()
    document.body.innerHTML = ""
    setup({ catalog: { booking_mode: "none" } })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog")
    })
    expect(screen.queryByText("Tarihler ve kontenjan")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/admin/products/prod_1/booking-slots",
      expect.anything()
    )
  })

  it("checks a new departure's fields, then sends its start with the zone's offset", async () => {
    setup({ slots: [] })
    await userEvent.click(await screen.findByRole("button", { name: "Kalkış ekle" }))
    const dialog = screen.getByRole("dialog", { name: "Kalkış ekle" })
    // Something typed lights the save; an empty start and a zero capacity are refused
    await userEvent.type(within(dialog).getByLabelText(/Kontenjan/), "0")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    expect(
      await within(dialog).findByText("Başlangıç tarihi ve saatini girin.")
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText("Kontenjan 1 ile 10.000 arasında tam sayı olmalı.")
    ).toBeInTheDocument()
    expect(posts()).toHaveLength(0)

    fireEvent.change(within(dialog).getByLabelText(/Başlangıç tarihi/), {
      target: { value: "2099-05-02T09:00" },
    })
    await userEvent.clear(within(dialog).getByLabelText(/Kontenjan/))
    await userEvent.type(within(dialog).getByLabelText(/Kontenjan/), "12")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/booking-slots", {
        method: "POST",
        body: { slots: [{ starts_at: "2099-05-02T09:00:00+03:00", capacity: 12 }] },
      })
    })
  })

  it("keeps a departure's capacity above what is sold and held, and words the server's refusal", async () => {
    setup({ refuse: { status: 400, message: "booking.capacity_below_sold" } })
    await userEvent.click(await screen.findByRole("button", { name: /09:00: düzenle/ }))
    const dialog = screen.getByRole("dialog", { name: "Kalkışı düzenle" })
    const capacity = within(dialog).getByLabelText(/Kontenjan/)
    await userEvent.clear(capacity)
    await userEvent.type(capacity, "4")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    expect(
      await within(dialog).findByText(
        "Kontenjan, satılan ve sepetlerde tutulan yer sayısının altına indirilemez."
      )
    ).toBeInTheDocument()
    expect(posts()).toHaveLength(0)

    // Within the form's rule; the server still refuses (a cart took a place meanwhile)
    await userEvent.clear(capacity)
    await userEvent.type(capacity, "5")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Kontenjan, satılan ve sepetlerde tutulan yer sayısının altına indirilemez."
    )
    expect(posts()).toEqual([
      ["/admin/booking-slots/bkslot_1", { method: "POST", body: { capacity: 5 } }],
    ])
  })

  it("asks before cancelling a departure with what it touches and the server's refund", async () => {
    setup()
    await userEvent.click(await screen.findByRole("button", { name: /09:00: iptal et/ }))
    const dialog = screen.getByRole("alertdialog", { name: "Kalkış iptal edilsin mi?" })
    const alert = await within(dialog).findByRole("alert")
    expect(alert).toHaveTextContent("Rezervasyon: 2 · sipariş: 2 · yer: 3")
    expect(alert).toHaveTextContent(/Toplam iade: ₺4\.500,00/)
    // A bank transfer or a gift card is refunded by hand: shown apart (review O2)
    expect(alert).toHaveTextContent(/Elle iade edilecek: ₺900,00 \(1 sipariş/)
    await userEvent.click(within(dialog).getByRole("button", { name: "Kalkışı iptal et" }))
    await waitFor(() => {
      expect(posts()).toEqual([
        ["/admin/booking-slots/bkslot_1/cancel", { method: "POST", body: {} }],
      ])
    })
  })

  it("does not offer a departure's cancel to a role that cannot give money back", async () => {
    setup({ money: false })
    await screen.findByRole("button", { name: /09:00: düzenle/ })
    expect(screen.queryByRole("button", { name: /09:00: iptal et/ })).toBeNull()
  })

  it("shows a departure's bookings by order, with no person's details", async () => {
    setup()
    await userEvent.click(await screen.findByRole("button", { name: /09:00: katılımcılar/ }))
    const dialog = await screen.findByRole("dialog", { name: "Katılımcılar" })
    const link = await within(dialog).findByRole("link", { name: "#1042" })
    expect(link).toHaveAttribute("href", "/orders/order_1")
    expect(within(dialog).getByText("Onaylı")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/booking-slots/bkslot_1/bookings")
  })
})
