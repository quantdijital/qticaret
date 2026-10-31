import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { InvoiceRecord } from "@/features/orders/api/invoices"
import { ReturnDocuments } from "./return-documents"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const record = (changes: Partial<InvoiceRecord> = {}): InvoiceRecord => ({
  id: "inv_r1",
  order_id: "order_1",
  kind: "return",
  provider: "external",
  status: "pending",
  document_type: "expense_voucher",
  number: null,
  uuid: null,
  issued_at: null,
  cancellable_until: null,
  attempts: 0,
  last_error: null,
  has_pdf: false,
  total: "120.00",
  program_difference: null,
  created_at: "2026-10-31T09:00:00.000Z",
  ...changes,
})

const renderList = (rows: InvoiceRecord[], mayOpen = true) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReturnDocuments records={rows} mayOpen={mayOpen} orderNumber={1042} />
    </QueryClientProvider>
  )

describe("ReturnDocuments", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ changed: true })
  })

  it("shows a gider pusulası waiting, and records why none is needed", async () => {
    renderList([record()])

    expect(screen.getByText("Gider pusulası")).toBeInTheDocument()
    expect(screen.getByText("Düzenlenmeyi bekliyor · ₺120,00")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Belge gerekmiyor" }))
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /ödeme kuruluşu üzerinden iade edildi/u })
    )
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/invoices/inv_r1/waive", {
        method: "POST",
        body: { reason: "payment_institution" },
      })
    })
  })

  it("enters the form's serial upper-cased, and says why one was not needed", async () => {
    const { unmount } = renderList([record()])
    await userEvent.click(screen.getByRole("button", { name: "Belgeyi işle" }))
    await userEvent.type(screen.getByLabelText(/^Seri \/ sıra no/u), "gp 000123")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/invoices/inv_r1/return-document", {
        method: "POST",
        body: { number: "GP 000123", issued_at: expect.any(String) as string },
      })
    })
    unmount()

    renderList([record({ status: "waived", waived_reason: "signed_return_section" })])
    expect(screen.getByText("Gerekmedi: imzalı iade bölümü")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Belgeyi işle" })).not.toBeInTheDocument()
  })

  it("asks a company's return invoice, and offers nothing to a role that may not open it", () => {
    const { unmount } = renderList([record({ document_type: "return_invoice" })])
    expect(screen.getByText("Şirketin iade faturası")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Belge gerekmiyor" })).not.toBeInTheDocument()
    unmount()

    renderList([record()], false)
    expect(screen.queryByRole("button", { name: "Belgeyi işle" })).not.toBeInTheDocument()
  })
})
