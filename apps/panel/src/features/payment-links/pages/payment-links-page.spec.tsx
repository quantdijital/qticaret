import { QueryClientProvider } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { MouseEventHandler, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { PaymentLinkSummary } from "@/features/payment-links/api/types"
import { clientWith, inDays, summary } from "@/features/payment-links/payment-links.fixtures"
import { PaymentLinksPage } from "./payment-links-page"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const search = vi.hoisted((): { current: Record<string, unknown> } => ({ current: {} }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    onClick,
  }: {
    children: ReactNode
    to: string
    onClick?: MouseEventHandler
  }) => (
    <a href={to} onClick={onClick}>
      {children}
    </a>
  ),
  getRouteApi: () => ({ useSearch: () => search.current }),
  useNavigate: () => navigate,
}))

const ROWS: PaymentLinkSummary[] = [
  summary({
    id: "plink_1",
    number: "PL-1042",
    discount_total: 2_700,
    total: 24_300,
    discount: { type: "percentage", value: 10, amount: 2_700, reason: "Sadık müşteri" },
    created_by: "user_2",
  }),
  summary({
    id: "plink_2",
    number: "PL-1041",
    status: "draft",
    customer: { id: "cus_1", name: "Mehmet K.", email: "m***@example.com" },
    created_by: "user_1",
  }),
]

function serve(rows: PaymentLinkSummary[] = ROWS) {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/admin/payment-links") {
      return Promise.resolve({ payment_links: rows, count: rows.length, limit: 50, offset: 0 })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

function renderPage(client: QueryClient = clientWith()) {
  return render(
    <QueryClientProvider client={client}>
      <PaymentLinksPage />
    </QueryClientProvider>
  )
}

describe("PaymentLinksPage (adr/0051 §13)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    search.current = {}
    serve()
  })

  it("lists each link with its masked customer, total, discount, state and maker", async () => {
    renderPage()

    const first = within((await screen.findByText("PL-1042")).closest("tr") as HTMLElement)
    expect(first.getByText("Ayşe Y.")).toBeInTheDocument()
    expect(first.getByText("a***@example.com")).toBeInTheDocument()
    expect(first.getByText("₺243,00")).toBeInTheDocument()
    expect(first.getByText("₺27,00 indirim")).toBeInTheDocument()
    expect(first.getByText("Açık")).toBeInTheDocument()
    expect(first.getByText("Ece Demir")).toBeInTheDocument()

    const second = within(screen.getByText("PL-1041").closest("tr") as HTMLElement)
    expect(second.getByText("Fiyat değişti")).toBeInTheDocument()
    expect(second.getByText("Siz")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/payment-links", {
      query: { limit: 50, offset: 0 },
    })
    expect(screen.getByRole("link", { name: "Yeni sipariş" })).toHaveAttribute(
      "href",
      "/payment-links/new"
    )
  })

  it("asks the server for the state, the discount and the maker from the address", async () => {
    search.current = { status: "paid", discounted: "true", created_by: "user_2", page: 2 }
    renderPage()

    await screen.findByText("PL-1042")
    expect(fetchMock).toHaveBeenCalledWith("/admin/payment-links", {
      query: { status: "paid", discounted: "true", created_by: "user_2", limit: 50, offset: 50 },
    })

    await userEvent.click(screen.getByRole("tab", { name: "Süresi doldu" }))
    expect(navigate).toHaveBeenLastCalledWith({
      to: "/payment-links",
      search: { status: "expired", discounted: "true", created_by: "user_2", page: undefined },
      replace: true,
    })
  })

  it("narrows to discounted links from the discount filter", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("PL-1042")

    await user.click(screen.getByRole("combobox", { name: "İndirim" }))
    await user.click(await screen.findByRole("option", { name: "İndirimli" }))

    expect(navigate).toHaveBeenLastCalledWith({
      to: "/payment-links",
      search: { status: undefined, discounted: "true", created_by: undefined, page: undefined },
      replace: true,
    })
  })

  it("says so when a filter leaves nothing", async () => {
    serve([])
    search.current = { status: "canceled" }
    renderPage()

    expect(await screen.findByText("Bu süzgeçlere uyan bağlantı yok.")).toBeInTheDocument()
  })

  it("says the feature is off, with the way to turn it on, instead of asking for a list", () => {
    renderPage(clientWith({ flag: false }))

    expect(screen.getByText(/Ödeme bağlantıları bu mağazada kapalı/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Özelliklerden aç" })).toHaveAttribute(
      "href",
      "/settings/features"
    )
    expect(screen.queryByRole("link", { name: "Yeni sipariş" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("keeps the screen from a role that cannot make links", () => {
    renderPage(clientWith({ role: "readonly" }))

    expect(screen.getByText(/yalnız mağaza sahibi, yöneticiler ve operasyon/)).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Özelliklerden aç" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("opens to the operations team, who make links without a discount", async () => {
    renderPage(clientWith({ role: "operations" }))

    expect(await screen.findByText("PL-1042")).toBeInTheDocument()
    // Operations cannot read the team: another maker is "a team member"
    expect(
      within(screen.getByText("PL-1042").closest("tr") as HTMLElement).getByText("Ekip üyesi")
    ).toBeInTheDocument()
  })

  it("names the maker as the backend sends it, for a role that cannot read the team", async () => {
    serve([summary({ created_by: "user_2", created_by_name: "Ece Demir" })])
    renderPage(clientWith({ role: "operations" }))

    const row = within((await screen.findByText("PL-1042")).closest("tr") as HTMLElement)
    expect(row.getByText("Ece Demir")).toBeInTheDocument()
    expect(row.queryByText("Ekip üyesi")).toBeNull()
  })

  it("shows an open link past its end as expired, an open one within it as open", async () => {
    serve([
      summary({ id: "plink_1", number: "PL-1042", expires_at: inDays(-1) }),
      summary({ id: "plink_2", number: "PL-1041", expires_at: inDays(1) }),
    ])
    renderPage()

    const ended = within((await screen.findByText("PL-1042")).closest("tr") as HTMLElement)
    expect(ended.getByText("Süresi doldu")).toBeInTheDocument()
    expect(ended.queryByText("Açık")).toBeNull()
    const live = within(screen.getByText("PL-1041").closest("tr") as HTMLElement)
    expect(live.getByText("Açık")).toBeInTheDocument()
  })
})
