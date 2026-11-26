import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { PttRanges } from "@/features/settings/api/ptt-barcodes"
import { PttBarcodeCard } from "./ptt-barcode-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const range = (over: Partial<PttRanges["ranges"][number]> = {}) => ({
  id: "pttbr_1",
  first: "275036569000",
  last: "275036569999",
  size: 1000,
  used: 0,
  remaining: 1000,
  created_at: "2026-11-26T10:00:00Z",
  ...over,
})

function renderCard(view: PttRanges) {
  fetchMock.mockImplementation((_url: string, init?: { method?: string }) =>
    Promise.resolve(init?.method ? { id: "pttbr_2" } : view)
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PttBarcodeCard />
    </QueryClientProvider>
  )
}

const input = (id: string) => document.getElementById(id) as HTMLInputElement
const posts = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method)

describe("PttBarcodeCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("says no parcel goes without a range", async () => {
    renderCard({ ranges: [], remaining: 0, total: 0, low: false })

    expect(await screen.findByTestId("ptt-ranges-summary")).toHaveTextContent(/Aralık olmadan/)
    expect(input("ptt-range-first").placeholder).toMatch(/^Örn\./)
  })

  it("warns when few are left, and offers removal only for an unused range", async () => {
    renderCard({
      ranges: [
        range({ used: 960, remaining: 40 }),
        range({
          id: "pttbr_2",
          first: "275036570000",
          last: "275036570009",
          size: 10,
          remaining: 10,
        }),
      ],
      remaining: 50,
      total: 1010,
      low: true,
    })

    expect(await screen.findByTestId("ptt-ranges-summary")).toHaveTextContent(/azalıyor: 50/)
    expect(screen.getByText("960 / 1.000 kullanıldı · 40 kaldı")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /aralığını sil/ })).toHaveLength(1)
  })

  it("says the range is used up", async () => {
    renderCard({
      ranges: [range({ used: 1000, remaining: 0 })],
      remaining: 0,
      total: 1000,
      low: true,
    })

    expect(await screen.findByTestId("ptt-ranges-summary")).toHaveTextContent(/bitti/)
  })

  it("checks both ends before adding, then adds and empties the form", async () => {
    renderCard({ ranges: [], remaining: 0, total: 0, low: false })
    await screen.findByTestId("ptt-ranges-summary")
    await userEvent.type(input("ptt-range-first"), "275036569999")
    await userEvent.type(input("ptt-range-last"), "275036569000")
    await userEvent.click(screen.getByRole("button", { name: "Aralığı ekle" }))

    expect(await screen.findByText(/başlangıçtan küçük/)).toBeInTheDocument()
    expect(posts()).toHaveLength(0)

    await userEvent.clear(input("ptt-range-first"))
    await userEvent.type(input("ptt-range-first"), "275036568000")
    await userEvent.click(screen.getByRole("button", { name: "Aralığı ekle" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/shipping-setup/ptt-barcodes", {
        method: "POST",
        body: { first: "275036568000", last: "275036569000" },
      })
    })
    await waitFor(() => {
      expect(input("ptt-range-first").value).toBe("")
    })
  })
})
