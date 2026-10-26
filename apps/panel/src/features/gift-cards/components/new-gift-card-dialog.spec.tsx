import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { NewGiftCardDialog } from "./new-gift-card-dialog"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <NewGiftCardDialog open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  )
}

describe("NewGiftCardDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      gift_card: { id: "gcard_1", code: "GIFT-ABCD-EFGH", value: 250, currency_code: "try" },
    })
  })

  it("asks for at least 1 lira", async () => {
    renderDialog()
    await userEvent.type(screen.getByLabelText(/^Tutar/u), "0,50")
    await userEvent.click(screen.getByRole("button", { name: "Kartı oluştur" }))
    expect(screen.getByText("En az 1 ₺ olan bir tutar girin.")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("makes the card on Enter", async () => {
    renderDialog()
    await userEvent.type(screen.getByLabelText(/^Tutar/u), "100{Enter}")
    expect(await screen.findByText("GIFT-ABCD-EFGH")).toBeInTheDocument()
  })

  it("makes a card to the end of its last day, Türkiye time, then shows its code", async () => {
    renderDialog()
    await userEvent.type(screen.getByLabelText(/^Tutar/u), "250")
    fireEvent.change(screen.getByLabelText(/^Son kullanma günü/u), {
      target: { value: "2026-12-31" },
    })
    await userEvent.click(screen.getByRole("button", { name: "Kartı oluştur" }))
    expect(await screen.findByText("GIFT-ABCD-EFGH")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/gift-cards", {
      method: "POST",
      body: {
        currency_code: "try",
        value: 250,
        expires_at: "2026-12-31T20:59:59.000Z",
        note: null,
      },
    })
    expect(screen.getByRole("button", { name: "Kodu kopyala" })).toBeInTheDocument()
  })
})
