import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { InvoiceDraft } from "@/features/orders/api/invoices"
import { InvoiceDraftDialog } from "./invoice-draft-dialog"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

const draft: InvoiceDraft = {
  order: { id: "order_1", number: "1042", date: "2026-10-31" },
  buyer: {
    kind: "person",
    name: "Ayşe Yılmaz",
    tax_id: "11111111111",
    tax_office: null,
    email: "ayse@example.com",
    phone: "+905551112233",
    address: "Moda Cad. No: 1",
    city: "İstanbul",
    district: "Kadıköy",
    postal_code: "34710",
  },
  lines: [
    {
      description: "Döküm tava - 20 cm",
      quantity: 2,
      unit_net: "100.0000",
      discount_net: "20.00",
      vat_rate: 20,
      net: "180.00",
      vat: "36.00",
      gross: "216.00",
    },
    {
      description: "Kargo bedeli - Aras Kargo - kapıda ödeme dahil",
      quantity: 1,
      unit_net: "74.9167",
      discount_net: "0.00",
      vat_rate: 20,
      net: "74.92",
      vat: "14.98",
      gross: "89.90",
    },
  ],
  totals: { net: "254.92", vat: "50.98", gross: "305.90" },
  internet_sale: {
    url: "https://ornek.com",
    payment: "bank_transfer",
    platform: null,
    paid_on: "2026-10-31",
  },
  shipment: null,
}

const renderDialog = (answer: { draft: InvoiceDraft | null; problems: string[] }) => {
  fetchMock.mockResolvedValue(answer)
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <InvoiceDraftDialog invoiceId="inv_1" orderNumber={1042} onClose={onClose} />
    </QueryClientProvider>
  )
  return onClose
}

describe("InvoiceDraftDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows the buyer, the lines, KDV by rate and the totals to type in", async () => {
    renderDialog({ draft, problems: [] })

    expect(await screen.findByText("Fatura taslağı #1042")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/invoices/inv_1/draft", {})
    expect(screen.getByText("11111111111 (alıcı numara vermedi)")).toBeInTheDocument()
    expect(screen.getByText("EFT / havale")).toBeInTheDocument()
    expect(screen.getByText("Kargoya verilince yazılır")).toBeInTheDocument()
    const [, pan, shipping] = screen.getAllByRole("row")
    if (!pan || !shipping) {
      throw new Error("the lines are not shown")
    }
    expect(within(pan).getByText("₺100,00")).toBeInTheDocument()
    expect(within(shipping).getByText("₺74,9167")).toBeInTheDocument()
    expect(screen.getByText(/Matrah ₺254,92 · KDV ₺50,98/u)).toBeInTheDocument()
    expect(screen.getByText("₺305,90")).toBeInTheDocument()
  })

  it("says what is missing when the draft cannot be made", async () => {
    renderDialog({ draft: null, problems: ["einvoice.address_missing"] })

    expect(await screen.findByText("Siparişte fatura adresi yok.")).toBeInTheDocument()
  })
})
