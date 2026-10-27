import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { BankTransferAlert } from "./bank-transfer-alert"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

function renderAlert() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <BankTransferAlert
        orderId="order_1"
        displayId={213}
        state={{ awaiting: true, deadline: "2026-10-29T20:00:00.000Z", confirmed_at: null }}
      />
    </QueryClientProvider>
  )
}

describe("BankTransferAlert", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ bank_transfer: { order_id: "order_1", made_before: false } })
  })

  it("says until when the transfer is awaited, and confirms it only after asking", async () => {
    renderAlert()

    expect(screen.getByText(/#213 siparişinin havalesi bekleniyor; son gün/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Havale geldi" }))
    expect(fetchMock).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole("button", { name: "Havale geldi" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/bank-transfer/confirm", {
      method: "POST",
      body: {},
    })
  })
})
