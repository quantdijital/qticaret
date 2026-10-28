import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { CustomerSegment } from "@/features/customers/api/groups"
import { SegmentsCard } from "./segments-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const segment: CustomerSegment = {
  id: "cseg_1",
  name: "Geri kazanılacaklar",
  rules: { not_ordered_for_days: 90, email_consent: true },
  customer_group_id: "cusgroup_1",
  member_count: 12,
  refreshed_at: "2026-10-28T03:00:00Z",
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SegmentsCard />
    </QueryClientProvider>
  )
}

describe("SegmentsCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((path: string, init?: { method?: string }) =>
      Promise.resolve(
        path === "/admin/customer-segments" && !init?.method
          ? { segments: [segment] }
          : { segment, member_count: 13 }
      )
    )
  })

  it("lists each segment's rules in words and how many customers it holds", async () => {
    renderCard()

    expect(await screen.findByText("Geri kazanılacaklar")).toBeInTheDocument()
    expect(screen.getByText("90 gündür sipariş yok · e-posta izni var")).toBeInTheDocument()
    expect(screen.getByText(/12 müşteri/)).toBeInTheDocument()
  })

  it("makes a segment from the form, money as kuruş, and asks for a rule first", async () => {
    renderCard()
    await userEvent.click(await screen.findByRole("button", { name: "Yeni segment" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByLabelText(/Ad/), "Çok harcayanlar")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("En az bir kural")
    await userEvent.type(within(dialog).getByLabelText(/Toplam harcaması/), "2.500")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/customer-segments", {
        method: "POST",
        body: { name: "Çok harcayanlar", rules: { min_total_spent: 250000 } },
      })
    })
  })

  it("fills a segment now when asked", async () => {
    renderCard()
    await userEvent.click(await screen.findByRole("button", { name: "Şimdi güncelle" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/customer-segments/cseg_1/refresh", {
        method: "POST",
        body: {},
      })
    })
  })
})
