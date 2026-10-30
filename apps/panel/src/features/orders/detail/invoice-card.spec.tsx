import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { InvoiceRecord } from "@/features/orders/api/invoices"
import { InvoiceCard } from "./invoice-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const invoice = (changes: Partial<InvoiceRecord>): InvoiceRecord => ({
  id: "inv_1",
  order_id: "order_1",
  kind: "sale",
  provider: "parasut",
  status: "pending",
  document_type: null,
  number: null,
  uuid: null,
  issued_at: null,
  cancellable_until: null,
  attempts: 0,
  last_error: null,
  has_pdf: false,
  total: "240.00",
  program_difference: null,
  created_at: "2026-10-30T18:00:00.000Z",
  ...changes,
})

const renderCard = (row: InvoiceRecord | null) => {
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/admin/invoices" ? { invoices: row ? [row] : [], count: row ? 1 : 0 } : {}
    )
  )
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <InvoiceCard orderId="order_1" />
    </QueryClientProvider>
  )
}

describe("InvoiceCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows an issued invoice's number and kind, and says why one stopped", async () => {
    const { unmount } = renderCard(
      invoice({
        status: "issued",
        number: "SHT2026000000042",
        document_type: "e_archive",
        has_pdf: true,
      })
    )
    expect(await screen.findByText("SHT2026000000042")).toBeInTheDocument()
    expect(screen.getByText("e-Arşiv")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "PDF'i aç" })).toBeInTheDocument()
    unmount()

    renderCard(invoice({ status: "failed", attempts: 1, last_error: "einvoice.outcome_unknown" }))
    expect(await screen.findByText(/fatura kesilmiş olabilir/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/invoices/inv_1/retry", {
        method: "POST",
        body: {},
      })
    })
  })

  it("takes an invoice issued elsewhere by its GİB number, refusing another form", async () => {
    renderCard(invoice({ provider: "external" }))
    await userEvent.click(await screen.findByRole("button", { name: "Faturayı elle işle" }))
    await userEvent.type(screen.getByLabelText("Fatura no"), "abc2026")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByText(/GİB biçiminde olmalı/)).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText("Fatura no"))
    await userEvent.type(screen.getByLabelText("Fatura no"), "abc2026000000123")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/invoices/inv_1/issued",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            number: "ABC2026000000123",
            document_type: "e_archive",
          }) as unknown,
        })
      )
    })
  })

  it("says none was opened yet", async () => {
    renderCard(null)
    expect(await screen.findByText(/Henüz fatura yok/)).toBeInTheDocument()
  })
})
