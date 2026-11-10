import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { OrderDetail, OrderMoney } from "@/features/orders/api/orders"
import { formatMoney } from "@qticaret/admin-ui/lib/format"
import { RefundDialog } from "./refund-dialog"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const totals = { gross: "330.00", discount: "0.00", net: "330.00" }
const money: OrderMoney = {
  currency_code: "try",
  lines: [
    {
      id: "item_1",
      kind: "item",
      quantity: 2,
      returned: 0,
      gross: "240.00",
      discount: "0.00",
      net: "240.00",
      returned_net: "0.00",
      refunded_units: 0,
      refunded_net: "0.00",
    },
    {
      id: "ship_1",
      kind: "shipping",
      quantity: 1,
      returned: 0,
      gross: "90.00",
      discount: "0.00",
      net: "90.00",
      returned_net: "0.00",
      refunded_units: 0,
      refunded_net: "0.00",
    },
  ],
  ...totals,
  items: totals,
  shipping: totals,
  credit: "0.00",
  paid: "330.00",
  refunded: "0.00",
  refundable: "330.00",
}
const order = {
  id: "order_1",
  display_id: 42,
  items: [{ id: "item_1", title: "Seramik kupa", subtitle: null, thumbnail: null }],
} as unknown as OrderDetail

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <RefundDialog order={order} money={money} open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  )
}

const calls = (path: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith(path)) as [
    string,
    { body: unknown },
  ][]

describe("RefundDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string, init: { body: { amount?: number } }) =>
      Promise.resolve(
        url.endsWith("/preview")
          ? { refund: { amount: init.body.amount ? "50.00" : "120.00", refundable: "330.00" } }
          : { refund: {} }
      )
    )
  })

  it("asks the server what a unit gives back, and refunds it under the dialog's own key", async () => {
    renderDialog()
    expect(screen.getByRole("button", { name: "İade edilecekleri seçin" })).toBeDisabled()

    await userEvent.clear(screen.getByLabelText("Seramik kupa için iade adedi"))
    await userEvent.type(screen.getByLabelText("Seramik kupa için iade adedi"), "1")
    const confirm = await screen.findByRole("button", {
      name: `${formatMoney(120, "try")} iade et`,
    })
    await userEvent.click(confirm)

    await waitFor(() => {
      expect(calls("/refunds")).toHaveLength(1)
    })
    expect(calls("/preview").at(-1)?.[1].body).toEqual({ items: [{ id: "item_1", quantity: 1 }] })
    const sent = calls("/refunds")[0]?.[1].body as { items: unknown; reference: string }
    expect(sent.items).toEqual([{ id: "item_1", quantity: 1 }])
    expect(sent.reference).toMatch(/^[0-9a-f]{32}$/)
  })

  it("never lets more units be chosen than the line can give back", async () => {
    renderDialog()
    const units = screen.getByLabelText("Seramik kupa için iade adedi")

    await userEvent.clear(units)
    await userEvent.type(units, "9")

    expect(units).toHaveValue(2)
  })

  it("keeps a long product name inside the box at any width (2026-11-03)", () => {
    const long = "El Yapımı Yatağan Çakısı 22,5 cm | 4116 Alman Çeliği, Ceviz veya Kompakt Sap"
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <RefundDialog
          order={{ ...order, items: [{ ...order.items[0], title: long }] } as OrderDetail}
          money={money}
          open
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>
    )
    // The box's one column never grows to the name's width: the name truncates instead; its
    // body scrolls between the header and the footer (a pane, 2026-11-05)
    const box = screen.getByRole("dialog")
    expect(box).toHaveClass("grid-cols-[minmax(0,1fr)]", "overflow-hidden")
    expect(box.querySelector("[data-slot=dialog-body]")).toHaveClass(
      "group-data-[pane]/pane:overflow-y-auto"
    )
    const name = screen.getByText(long)
    expect(name).toHaveClass("truncate")
    expect(name.parentElement).toHaveClass("min-w-0", "flex-1")
    expect(screen.getByLabelText(`${long} için iade adedi`)).toBeInTheDocument()
  })

  it("previews a free amount", async () => {
    renderDialog()
    await userEvent.click(screen.getByRole("radio", { name: "Tutar girerek" }))
    await userEvent.type(screen.getByLabelText("İade tutarı"), "50")

    expect(
      await screen.findByRole("button", { name: `${formatMoney(50, "try")} iade et` })
    ).toBeEnabled()
    expect(calls("/preview").at(-1)?.[1].body).toEqual({ amount: 50 })
  })
})
