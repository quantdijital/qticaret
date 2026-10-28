import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { OrderDetail } from "@/features/orders/api/orders"
import { EditOrderDialog } from "./edit-dialog"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { productVariant: { list: vi.fn() } } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const order = {
  id: "order_1",
  display_id: 1042,
  items: [
    { id: "ordli_knife", title: "Şef bıçağı", quantity: 1, unit_price: 120 },
    { id: "ordli_board", title: "Kesme tahtası", quantity: 1, unit_price: 80 },
  ],
} as unknown as OrderDetail

describe("EditOrderDialog (adr/0033)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("works out the difference first, then saves it once staff collected it", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith("/preview")
          ? { difference: "40.00" }
          : { difference: "40.00", refund_error: null }
      )
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <EditOrderDialog order={order} onClose={vi.fn()} />
      </QueryClientProvider>
    )

    fireEvent.change(screen.getByLabelText("Şef bıçağı adedi"), { target: { value: "2" } })
    await userEvent.click(screen.getByRole("button", { name: "Kesme tahtası kalemini çıkar" }))
    await userEvent.click(screen.getByRole("button", { name: "Farkı hesapla" }))

    const change = {
      items: [
        { id: "ordli_knife", quantity: 2 },
        { id: "ordli_board", quantity: 0 },
      ],
      add: [],
    }
    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/edit/preview", {
      method: "POST",
      body: change,
    })
    expect(await screen.findByText(/Müşteri .*40,00.* ödeyecek/)).toBeInTheDocument()
    const save = screen.getByRole("button", { name: "Kaydet" })
    expect(save).toBeDisabled()

    await userEvent.click(screen.getByRole("checkbox", { name: /Farkı müşteriden aldım/ }))
    await userEvent.click(save)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/edit", {
        method: "POST",
        body: {
          ...change,
          expected_difference: 40,
          difference_collected: true,
          reference: expect.stringMatching(/^[0-9a-f]{32}$/) as string,
        },
      })
    })
  })

  it("asks again once the change moves after a preview", async () => {
    fetchMock.mockResolvedValue({ difference: "-20.00" })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <EditOrderDialog order={order} onClose={vi.fn()} />
      </QueryClientProvider>
    )

    fireEvent.change(screen.getByLabelText("Şef bıçağı birim fiyatı"), {
      target: { value: "100" },
    })
    await userEvent.click(screen.getByRole("button", { name: "Farkı hesapla" }))
    expect(await screen.findByText(/Müşteriye .*20,00.* iade edilecek/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Şef bıçağı birim fiyatı"), {
      target: { value: "90" },
    })

    expect(screen.getByRole("button", { name: "Farkı hesapla" })).toBeEnabled()
    expect(screen.queryByRole("button", { name: "Kaydet" })).not.toBeInTheDocument()
  })
})
