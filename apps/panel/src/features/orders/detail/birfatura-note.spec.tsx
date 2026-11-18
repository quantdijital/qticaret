import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { InvoiceRecord } from "@/features/orders/api/invoices"
import { InvoiceSection } from "./invoice-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const NUMBER = "ABC2026000000001"

const invoice = (changes: Partial<InvoiceRecord>): InvoiceRecord => ({
  id: "inv_1",
  order_id: "order_1",
  kind: "sale",
  provider: "birfatura",
  status: "pending",
  // BirFatura sends no document type or ETTN (adr/0072 §6): they stay empty
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
  created_at: "2026-11-18T08:00:00.000Z",
  ...changes,
})

const renderCard = (row: InvoiceRecord) => {
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/admin/invoices"
        ? { invoices: [row], count: 1, sale_hold: null }
        : url === "/admin/staff/me"
          ? { role: "owner", can: { invoices: true } }
          : {}
    )
  )
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <InvoiceSection orderId="order_1" />
    </QueryClientProvider>
  )
}

describe("InvoiceSection (BirFatura)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows BirFatura's invoice: number, date and PDF, no document type row", async () => {
    renderCard(
      invoice({
        status: "issued",
        number: NUMBER,
        issued_at: "2026-11-18T09:12:00.000Z",
        has_pdf: true,
      })
    )

    expect(await screen.findByText(NUMBER)).toBeInTheDocument()
    expect(screen.getByText("BirFatura")).toBeInTheDocument()
    expect(screen.getByText("Kesim")).toBeInTheDocument()
    expect(screen.queryByText("Belge")).toBeNull()
    expect(await screen.findByRole("button", { name: "PDF'i aç" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "PDF ekle" })).toBeNull()
    expect(screen.queryByText(/iptal edildi/)).toBeNull()
  })

  it("says a waiting one is BirFatura's to pull, and keeps the hand-entry fallback", async () => {
    renderCard(invoice({}))

    expect(await screen.findByText(/BirFatura'nın siparişi çekip/)).toBeInTheDocument()
    expect(screen.queryByText(/Programınızın numarayı/)).toBeNull()
    expect(screen.getByRole("button", { name: "Faturayı elle işle" })).toBeInTheDocument()
  })

  it.each([
    ["handed to BirFatura, not reported", "pending"],
    ["issued at BirFatura", "issued"],
  ] as const)("flags a canceled order whose invoice was %s", async (_, status) => {
    renderCard(
      invoice({
        status,
        number: status === "issued" ? NUMBER : null,
        last_error: "einvoice.return_document_needed",
      })
    )

    expect(
      await screen.findByText(
        /Sipariş iptal edildi; fatura BirFatura'ya verilmişti\. BirFatura'da kontrol edin, kesildiyse iptal edin .* ya da iade belgesi düzenleyin\./
      )
    ).toBeInTheDocument()
    // Never the other program's words, never "waiting"
    expect(screen.queryByText(/Kendi programınızda kestiyseniz/)).toBeNull()
    expect(screen.queryByText(/BirFatura'nın siparişi çekip/)).toBeNull()
  })

  it("says what a report BirFatura sent could not give, and offers the PDF by hand", async () => {
    const { unmount } = renderCard(
      invoice({ status: "issued", number: NUMBER, last_error: "einvoice.pdf_download_failed" })
    )
    expect(await screen.findByText(/PDF'i indirilemedi/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "PDF ekle" })).toBeInTheDocument()
    unmount()

    const second = renderCard(invoice({ last_error: "einvoice.number_missing" }))
    expect(await screen.findByText(/numarasını göndermedi/)).toBeInTheDocument()
    second.unmount()

    renderCard(invoice({ last_error: "einvoice.something_new" }))
    expect(
      await screen.findByText(/bildirimi işlenemedi \(einvoice\.something_new\)/)
    ).toBeInTheDocument()
  })
})
