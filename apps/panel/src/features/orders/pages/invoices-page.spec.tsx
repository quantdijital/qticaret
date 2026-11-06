import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { InvoiceRecord } from "@/features/orders/api/invoices"
import { InvoicesPage } from "./invoices-page"

const fetchMock = vi.hoisted(() => vi.fn())

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/orders/order_1">{children}</a>,
  getRouteApi: () => ({ useSearch: () => ({ view: "all" }) }),
  useNavigate: () => vi.fn(),
}))

const invoice = (changes: Partial<InvoiceRecord>): InvoiceRecord => ({
  id: "inv_1",
  order_id: "order_1",
  kind: "sale",
  provider: "parasut",
  status: "issued",
  document_type: "e_archive",
  number: "SHT2026000000042",
  uuid: null,
  issued_at: "2026-11-03T10:00:00.000Z",
  cancellable_until: null,
  attempts: 1,
  last_error: null,
  has_pdf: true,
  total: "240.00",
  advance: null,
  program_difference: null,
  created_at: "2026-11-03T09:00:00.000Z",
  order_display_id: 1042,
  ...changes,
})

const rowOf = (number: number) => {
  const row = screen.getByText(`#${String(number)}`).closest("tr")
  if (!row) {
    throw new Error(`No row for #${String(number)}`)
  }
  return within(row)
}

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <InvoicesPage />
    </QueryClientProvider>
  )
}

describe("InvoicesPage: the queue's rows and the stopped ones tried again", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toast.success.mockReset()
    toast.error.mockReset()
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/admin/invoices/retry"
          ? {
              results: [
                { invoice_id: "inv_1", ok: true, error: null, message: null },
                {
                  invoice_id: "inv_2",
                  ok: false,
                  error: "einvoice.not_failed",
                  message: "Yalnızca durmuş bir fatura yeniden denenebilir.",
                },
              ],
            }
          : {
              invoices: [
                invoice({ id: "inv_1", status: "failed", number: null, last_error: "x" }),
                invoice({
                  id: "inv_2",
                  order_id: "order_2",
                  order_display_id: 1043,
                  status: "failed",
                  number: null,
                }),
                invoice({ id: "inv_3", order_id: "order_3", order_display_id: 1044 }),
              ],
              count: 3,
              limit: 20,
              offset: 0,
            }
      )
    )
  })

  it("opens a row's invoice in one standard dialog, with the way to its order", async () => {
    renderPage()
    await userEvent.click(await screen.findByText("SHT2026000000042"))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("#1044 siparişinin faturası")).toBeInTheDocument()
    expect(within(dialog).getByRole("link", { name: "Siparişe git" })).toBeInTheDocument()
  })

  it("tries the picked stopped invoices again and says which could not be", async () => {
    renderPage()
    await screen.findByText("#1042")
    await userEvent.click(screen.getByRole("checkbox", { name: "#1042 siparişinin faturası seç" }))
    await userEvent.click(screen.getByRole("checkbox", { name: "#1043 siparişinin faturası seç" }))
    // An issued one picked too is left out of the retry
    await userEvent.click(screen.getByRole("checkbox", { name: "#1044 siparişinin faturası seç" }))
    await userEvent.click(screen.getByRole("button", { name: "Yeniden dene (2)" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/invoices/retry", {
        method: "POST",
        body: { invoice_ids: ["inv_1", "inv_2"] },
      })
    })
    expect(toast.success).toHaveBeenCalledWith("1 fatura yeniden kuyruğa alındı.")
    expect(toast.error).toHaveBeenCalledWith(
      "1 fatura yeniden denenemedi: Yalnızca durmuş bir fatura yeniden denenebilir."
    )
  })
})

describe("InvoicesPage: gift card advances (adr/0025 Ek 2026-11-03)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      invoices: [
        invoice({ id: "inv_1", order_display_id: 1042, advance: "500.00" }),
        invoice({
          id: "inv_2",
          order_id: "order_2",
          order_display_id: 1043,
          status: "waived",
          waived_reason: "advance_only",
          document_type: null,
          number: null,
          total: "0.00",
          advance: "250.00",
        }),
        invoice({ id: "inv_3", order_id: "order_3", order_display_id: 1044, advance: "0.00" }),
      ],
      count: 3,
      limit: 20,
      offset: 0,
    })
  })

  it("shows an invoice's advance under its total and says gift cards alone got none", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <InvoicesPage />
      </QueryClientProvider>
    )

    expect(await screen.findByText("#1042")).toBeInTheDocument()
    expect(rowOf(1042).getByText("Avans (hediye kartı) ₺500,00")).toBeInTheDocument()
    expect(rowOf(1043).getByText("Yalnız hediye kartı: fatura yok, avans")).toBeInTheDocument()
    expect(rowOf(1043).getByText("Avans (hediye kartı) ₺250,00")).toBeInTheDocument()
    // A zero advance is no advance
    expect(rowOf(1044).queryByText(/Avans/)).toBeNull()
    expect(rowOf(1042).queryByText(/Yalnız hediye kartı/)).toBeNull()
  })
})
