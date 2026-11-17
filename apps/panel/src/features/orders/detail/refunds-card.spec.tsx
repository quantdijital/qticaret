import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ShopRefund } from "@/features/orders/api/payments"
import { RefundsCard } from "./refunds-card"

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))

const REFERENCE = "0123456789abcdef0123456789abcdef"
const refund = (fields: Partial<ShopRefund> = {}): ShopRefund => ({
  reference: REFERENCE,
  amount: "30.00",
  status: "pending",
  incomplete: true,
  note: null,
  created_at: "2026-11-17T10:00:00Z",
  ...fields,
})

function renderCard(refunds: ShopRefund[]) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RefundsCard orderId="order_1" refunds={refunds} currency="try" />
    </QueryClientProvider>
  )
}

describe("RefundsCard: an incomplete refund checked at the provider (review 2026-11-17, O2)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("asks whether the money went back, and tells the server what staff saw", async () => {
    fetchMock.mockResolvedValue({ refund: { status: "done" } })
    renderCard([refund()])

    await userEvent.click(screen.getByRole("button", { name: /sağlayıcıda kontrol et/i }))
    await userEvent.click(await screen.findByRole("button", { name: "Para gitti" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/admin/orders/order_1/refunds/${REFERENCE}/settle`, {
        method: "POST",
        body: { outcome: "made" },
      })
    })
    expect(toast.success).toHaveBeenCalledWith("İade kaydı tamamlandı.")
  })

  it("sends `not_made` for money that did not go back", async () => {
    fetchMock.mockResolvedValue({ refund: { status: "failed" } })
    renderCard([refund()])

    await userEvent.click(screen.getByRole("button", { name: /sağlayıcıda kontrol et/i }))
    await userEvent.click(await screen.findByRole("button", { name: "Para gitmedi" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/admin/orders/order_1/refunds/${REFERENCE}/settle`, {
        method: "POST",
        body: { outcome: "not_made" },
      })
    })
  })

  it("offers no check for a refund settled already", () => {
    renderCard([refund({ status: "done", incomplete: false })])

    expect(screen.queryByRole("button", { name: /sağlayıcıda kontrol et/i })).toBeNull()
    expect(screen.getByText("İade edildi")).toBeInTheDocument()
  })
})
