import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { GiftCardsPage } from "./gift-cards-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// Links as plain anchors: the page is rendered without a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}))

const CARD = {
  id: "gcard_1",
  code: "GIFT-ABCD-EFGH-JKLM-NPQR",
  value: 250,
  currency_code: "try",
  status: "pending",
  expires_at: null,
  note: null,
  created_at: "2026-10-26T10:00:00.000Z",
  store_credit_account: { balance: 100 },
}

function answers(enabled: boolean, count = 1) {
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/admin/features"
        ? { features: [{ key: "promotions.gift_cards", owner: "tenant", default: false, enabled }] }
        : { gift_cards: [CARD], count }
    )
  )
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <GiftCardsPage />
    </QueryClientProvider>
  )
}

describe("GiftCardsPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("lists the cards with what each has left while the feature is on", async () => {
    answers(true)
    renderPage()
    expect(await screen.findByText("GIFT-ABCD-EFGH-JKLM-NPQR")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Hediye kartları" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Hediye kartı oluştur" })).toBeInTheDocument()
  })

  it("says so when the shop has more cards than one read shows", async () => {
    answers(true, 1250)
    renderPage()
    expect(
      await screen.findByText("En yeni 1 kart gösteriliyor; mağazada toplam 1.250 kart var.")
    ).toBeInTheDocument()
  })

  it("points to the features page while it is off, and asks the server for no cards", async () => {
    answers(false)
    renderPage()
    expect(await screen.findByRole("link", { name: "Özelliklere git" })).toHaveAttribute(
      "href",
      "/settings/features"
    )
    expect(screen.queryByRole("button", { name: "Hediye kartı oluştur" })).toBeNull()
    expect(fetchMock.mock.calls.map((call) => call[0] as unknown)).toEqual(["/admin/features"])
  })
})
