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

  it("shows what to look for, asks once more, then tells the server what staff saw", async () => {
    fetchMock.mockResolvedValue({ refund: { status: "done" } })
    renderCard([refund({ provider: "paytr", sent_as: REFERENCE })])

    await userEvent.click(screen.getByRole("button", { name: /sağlayıcıda kontrol et/i }))
    // Who, which reference, how much: what the provider's panel is searched by
    expect(await screen.findByText("PayTR")).toBeInTheDocument()
    expect(screen.getAllByText(REFERENCE).length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole("button", { name: "Para gitti" }))
    // Chosen, not yet sent: asked once more
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText(/Emin misiniz: para müşteriye geri gitti mi/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Onayla" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/admin/orders/order_1/refunds/${REFERENCE}/settle`, {
        method: "POST",
        body: { outcome: "made" },
      })
    })
    expect(toast.success).toHaveBeenCalledWith("İade kaydı tamamlandı.")
  })

  it("sends `not_made` for money that did not go back, iyzico's parts shown", async () => {
    fetchMock.mockResolvedValue({ refund: { status: "failed" } })
    renderCard([refund({ provider: "iyzico", parts: [{ amount: "30.00", state: "sending" }] })])

    await userEvent.click(screen.getByRole("button", { name: /sağlayıcıda kontrol et/i }))
    expect(await screen.findByText(/yanıtı gelmedi/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Para gitmedi" }))
    await userEvent.click(screen.getByRole("button", { name: "Onayla" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/admin/orders/order_1/refunds/${REFERENCE}/settle`, {
        method: "POST",
        body: { outcome: "not_made" },
      })
    })
  })

  it("closes an iyzico refund made in part at its answered parts, the rest shown (D4-1)", async () => {
    fetchMock.mockResolvedValue({ refund: { status: "done" } })
    renderCard([
      refund({
        provider: "iyzico",
        amount: "300.00",
        parts: [{ amount: "240.00", state: "done" }],
      }),
    ])

    await userEvent.click(screen.getByRole("button", { name: /sağlayıcıda kontrol et/i }))
    expect(await screen.findByText("Bu iade kısmen yapıldı")).toBeInTheDocument()
    // What iyzico gave back and what is left: the record closes at the first
    expect(
      screen.getByText(/240,00 tutarındaki kısmını geri verdi; ₺60,00 geri verilmedi/)
    ).toBeInTheDocument()
    // One answer only: "money went back" or "did not" would both be refused
    expect(screen.queryByRole("button", { name: "Para gitti" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Para gitmedi" })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Yapılan kısmı kaydet" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText(/Emin misiniz: kayıt ₺240,00 olarak kapansın mı/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Onayla" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/admin/orders/order_1/refunds/${REFERENCE}/settle`, {
        method: "POST",
        body: { outcome: "made_in_part" },
      })
    })
    expect(toast.success).toHaveBeenCalledWith(
      "İade kaydı ₺240,00 olarak kapatıldı; kalan ₺60,00 yeniden iade edilebilir."
    )
  })

  it("keeps both answers when a part's answer was lost: never taken as made in part", async () => {
    renderCard([
      refund({
        provider: "iyzico",
        amount: "300.00",
        parts: [
          { amount: "240.00", state: "done" },
          { amount: "30.00", state: "sending" },
        ],
      }),
    ])

    await userEvent.click(screen.getByRole("button", { name: /sağlayıcıda kontrol et/i }))

    expect(await screen.findByRole("button", { name: "Para gitti" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Yapılan kısmı kaydet" })).toBeNull()
  })

  it("shows a refund closed in part as such", () => {
    renderCard([refund({ status: "done", incomplete: false, made_in_part: true })])

    expect(screen.getByText("Kısmen iade edildi")).toBeInTheDocument()
  })

  it("offers no check for a refund settled already", () => {
    renderCard([refund({ status: "done", incomplete: false })])

    expect(screen.queryByRole("button", { name: /sağlayıcıda kontrol et/i })).toBeNull()
    expect(screen.getByText("İade edildi")).toBeInTheDocument()
  })
})
