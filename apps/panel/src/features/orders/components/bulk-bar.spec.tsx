import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BoardOrder } from "@/features/orders/api/orders"
import { BulkBar } from "./bulk-bar"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))

const order = (id: string, more: Partial<BoardOrder>): BoardOrder => ({
  id,
  display_id: Number(id.replace(/\D/g, "")) || 1,
  created_at: "2026-10-30T08:00:00Z",
  currency_code: "try",
  total: "100.00",
  items: 1,
  stage: "to_ship",
  customer: { name: "Ayşe Yılmaz", place: "İstanbul" },
  shipping: null,
  delivery: { name: "Standart Kargo", carrier: null, pickup: false },
  ...more,
})

const PICKED = new Map(
  [
    order("order_1", { stage: "to_ship" }),
    order("order_2", {
      stage: "shipped",
      shipping: { status: "created", tracking_number: null, fulfillment_id: "ful_2" },
      delivery: { name: "Aras", carrier: "aras", pickup: false },
    }),
    order("order_3", { stage: "shipped" }),
    order("order_4", {
      stage: "shipped",
      shipping: { status: "in_transit", tracking_number: "T4", fulfillment_id: "ful_4" },
      delivery: { name: "Aras", carrier: "aras", pickup: false },
    }),
  ].map((each) => [each.id, each] as const)
)

function renderBar(onClear = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <BulkBar picked={PICKED} onClear={onClear} onShipped={vi.fn()} />
    </QueryClientProvider>
  )
  return onClear
}

describe("BulkBar", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.clearAllMocks()
  })

  it("offers each action for the picked orders it applies to", () => {
    renderBar()

    expect(screen.getByText("4 sipariş seçildi")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Kargoya ver \(1\)/ })).toBeInTheDocument()
    // The shop's own delivery only: a carrier's parcel is delivered by its tracking
    expect(screen.getByRole("button", { name: /Teslim edildi \(1\)/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /etiketi yazdır/ })).toBeInTheDocument()
  })

  it("marks the shop's own deliveries delivered and says how it went", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue({
      results: [{ order_id: "order_3", ok: true, delivered: 1, error: null, message: null }],
    })
    const onClear = renderBar()

    await user.click(screen.getByRole("button", { name: /Teslim edildi \(1\)/ }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/order-board/deliver", {
      method: "POST",
      body: { order_ids: ["order_3"] },
    })
    expect(toast.success).toHaveBeenCalledWith("1 sipariş teslim edildi olarak işaretlendi.")
    expect(onClear).toHaveBeenCalled()
  })
})
