import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { ChargebackDialog } from "./chargeback-dialog"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

describe("ChargebackDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ chargeback: { id: "chbk_1" } })
  })

  it("records the provider's notice with the paid amount by default, in lira", async () => {
    const client = new QueryClient()
    render(
      <QueryClientProvider client={client}>
        <ChargebackDialog
          orderId="order_1"
          displayId={42}
          paid="210"
          open
          onOpenChange={() => undefined}
        />
      </QueryClientProvider>
    )

    await userEvent.type(screen.getByLabelText("Sağlayıcı referansı"), "CB-1")
    await userEvent.click(screen.getByRole("button", { name: "Kaydı aç" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/chargebacks", {
      method: "POST",
      body: {
        order_id: "order_1",
        amount: 210,
        reason: "not_received",
        provider_reference: "CB-1",
      },
    })
  })
})
