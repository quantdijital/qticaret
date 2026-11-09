import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { GiftCardsPage } from "./gift-cards-page"

const fetchMock = vi.hoisted(() => vi.fn())
const search = vi.hoisted<{ card?: string; q?: string; state?: string; page?: number }>(() => ({}))
const navigateMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// Links as plain anchors, the address's card as each test sets it: rendered without a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  getRouteApi: () => ({ useSearch: () => search }),
  useNavigate: () => navigateMock,
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
  store_credit_account: { id: "sca_1", balance: 100 },
}

function answers(enabled: boolean, count = 1, card: typeof CARD = CARD) {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/admin/features") {
      return Promise.resolve({
        features: [{ key: "promotions.gift_cards", owner: "tenant", default: false, enabled }],
      })
    }
    if (url === "/admin/gift-cards/gcard_1") {
      return Promise.resolve({ gift_card: card })
    }
    if (url === "/admin/store-credit-accounts/sca_1") {
      // Spent a little meanwhile: the debit takes what is left now
      return Promise.resolve({ store_credit_account: { id: "sca_1", balance: 80 } })
    }
    if (url === "/admin/store-credit-accounts/sca_1/debit") {
      return Promise.resolve({ store_credit_account: { id: "sca_1", balance: 0 } })
    }
    return Promise.resolve({ gift_cards: [card], count, limited: false })
  })
}

const MASKED = "GIFT-••••-••••-••••-NPQR"

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
    navigateMock.mockReset()
    delete search.card
    delete search.q
    delete search.state
    delete search.page
  })

  it("lists the cards with what each has left while the feature is on, codes masked", async () => {
    answers(true)
    renderPage()
    expect(await screen.findByText(MASKED)).toBeInTheDocument()
    expect(screen.queryByText(CARD.code)).toBeNull()
    expect(screen.getByRole("link", { name: "Hediye kartları" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Hediye kartı oluştur" }).length).toBeGreaterThan(
      0
    )
    expect(fetchMock).toHaveBeenCalledWith("/admin/gift-card-list", { query: { offset: 0 } })
  })

  it("asks a page by the code searched and the state chosen, and pages on", async () => {
    search.q = "gift-ab"
    search.state = "used"
    search.page = 2
    answers(true, 60)
    renderPage()
    expect(await screen.findByText(MASKED)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/gift-card-list", {
      query: { q: "gift-ab", state: "used", offset: 25 },
    })
    expect(screen.getByRole("tab", { name: "Kullanıldı" })).toHaveAttribute("aria-selected", "true")

    await userEvent.click(screen.getByRole("button", { name: /Sonraki/ }))
    expect(navigateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: { q: "gift-ab", state: "used", page: 3 } })
    )
    await userEvent.click(screen.getByRole("tab", { name: "Süresi doldu" }))
    expect(navigateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: { q: "gift-ab", state: "expired", page: undefined } })
    )
  })

  it("says nothing matched a search, without offering a new card there", async () => {
    search.q = "YOK"
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === "/admin/features"
          ? { features: [{ key: "promotions.gift_cards", enabled: true }] }
          : { gift_cards: [], count: 0, limited: false }
      )
    )
    renderPage()
    expect(await screen.findByText("Aramanızla eşleşen kart yok.")).toBeInTheDocument()
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

  it("closes a card once asked: what is left now is debited, the reason in its note", async () => {
    answers(true)
    renderPage()
    await userEvent.click(
      await screen.findByRole("button", { name: `${MASKED} kartının işlemleri` })
    )
    await userEvent.click(await screen.findByRole("menuitem", { name: "Kartı kapat" }))

    const dialog = await screen.findByRole("dialog", { name: "Kartı kapat" })
    expect(dialog).toHaveTextContent(`${MASKED} kodlu kartta kalan`)
    expect(dialog).toHaveTextContent("geri alınamaz")
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/admin/store-credit-accounts"),
      expect.anything()
    )

    await userEvent.type(within(dialog).getByLabelText("Neden"), "Sipariş iade edildi")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kartı kapat" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/store-credit-accounts/sca_1/debit", {
        method: "POST",
        body: { amount: 80, note: "Kart panelden kapatıldı: Sipariş iade edildi" },
      })
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/store-credit-accounts/sca_1", {
      query: { fields: "id,balance" },
    })
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  it("offers no closing for a card with nothing left", async () => {
    answers(true, 1, { ...CARD, store_credit_account: { id: "sca_1", balance: 0 } })
    renderPage()
    expect(await screen.findByText("Kullanıldı")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /kartının işlemleri/ })).toBeNull()
  })

  it("shows the one card an order links to, and the way back to all", async () => {
    search.card = "gcard_1"
    answers(true)
    renderPage()
    expect(await screen.findByText(MASKED)).toBeInTheDocument()
    expect(screen.getByText("Yalnızca bir kart gösteriliyor.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Tüm kartlar" })).toHaveAttribute(
      "href",
      "/promotions/gift-cards"
    )
    expect(fetchMock).toHaveBeenCalledWith("/admin/gift-cards/gcard_1", {
      query: { fields: expect.stringContaining("store_credit_account.id") as unknown },
    })
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/gift-card-list", expect.anything())
  })
})
