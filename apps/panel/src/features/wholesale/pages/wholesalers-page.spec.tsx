import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { WholesaleAccount } from "@/features/wholesale/api/types"
import {
  account,
  clientWith,
  nth,
  pendingAccount,
  renderWith,
} from "@/features/wholesale/wholesale.fixtures"
import { WholesalersPage } from "./wholesalers-page"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const search = vi.hoisted(() => ({ current: {} }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  getRouteApi: () => ({ useSearch: () => search.current }),
  useNavigate: () => navigate,
}))

type Call = [string, { query?: Record<string, unknown> } | undefined]

/** The list's reads (not the tab counts, which ask for one row). */
const listReads = () =>
  (fetchMock.mock.calls as Call[]).filter(
    ([path, init]) => path === "/admin/wholesale/accounts" && init?.query?.["limit"] === 20
  )

function serve(accounts: WholesaleAccount[], count = accounts.length) {
  fetchMock.mockImplementation((path: string, init?: { query?: Record<string, unknown> }) =>
    Promise.resolve(
      path === "/admin/wholesale/accounts"
        ? {
            accounts: init?.query?.["limit"] === 1 ? [] : accounts,
            count,
            limit: 20,
            offset: 0,
          }
        : { tiers: [], count: 0 }
    )
  )
}

describe("WholesalersPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    search.current = {}
  })

  it("lists wholesalers with their prices, state and invitation", async () => {
    serve([
      account({ own_prices: true, percent: 12.5 }),
      pendingAccount({ tier: null, own_prices: true }),
    ])
    renderWith(clientWith(), <WholesalersPage />)
    expect(await screen.findByText("Kaya Bıçak Ltd")).toBeInTheDocument()
    expect(screen.getByText("satinalma@kayabicak.com.tr")).toBeInTheDocument()
    expect(screen.getByText("Toptan A + Özel fiyat")).toBeInTheDocument()
    expect(screen.getByText("%12,5")).toBeInTheDocument()
    expect(screen.getAllByText("Etkin").length).toBeGreaterThan(0)
    expect(screen.getByText(/^2 kez gönderildi · .* tarihine kadar geçerli$/)).toBeInTheDocument()
    expect(listReads()[0]?.[1]?.query).toEqual({ limit: 20, offset: 0 })
  })

  it("filters by state and search, and pages through the API", async () => {
    search.current = { status: "pending", q: "kaya", page: 2 }
    serve([pendingAccount()], 45)
    renderWith(clientWith(), <WholesalersPage />)
    await screen.findByText("Yılmaz Ticaret")
    expect(listReads()[0]?.[1]?.query).toEqual({
      limit: 20,
      offset: 20,
      q: "kaya",
      status: "pending",
    })
    await userEvent.click(screen.getByRole("button", { name: "Sonraki sayfa" }))
    expect(navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: { q: "kaya", status: "pending", page: 3 } })
    )
    await userEvent.click(screen.getByRole("tab", { name: /Kapalı/ }))
    expect(navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: { q: "kaya", status: "inactive", page: undefined } })
    )
  })

  it("opens a wholesaler's page from its row", async () => {
    serve([account()])
    renderWith(clientWith(), <WholesalersPage />)
    await userEvent.click(await screen.findByText("Kaya Bıçak Ltd"))
    expect(navigate).toHaveBeenCalledWith({
      to: "/customers/wholesale/$id",
      params: { id: "wsa_1" },
    })
  })

  it("offers the one action when there is no wholesaler yet", async () => {
    serve([])
    renderWith(clientWith(), <WholesalersPage />)
    expect(
      await screen.findByText("Henüz toptancı yok. Bir toptancı açtığınızda burada görünür.")
    ).toBeInTheDocument()
    await userEvent.click(nth(screen.getAllByRole("button", { name: "Yeni toptancı" }), 1))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })

  it("is closed while the shop has wholesale off, the switch offered", async () => {
    serve([account()])
    renderWith(clientWith({ flag: false }), <WholesalersPage />)
    expect(screen.getByText(/Toptan satış bu mağazada kapalı/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Özelliklere git" })).toHaveAttribute(
      "href",
      "/settings/features"
    )
    expect(screen.queryByRole("button", { name: "Yeni toptancı" })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(listReads()).toHaveLength(0)
    })
  })

  it("is closed to operations staff, the menu entries left out", () => {
    serve([account()])
    renderWith(clientWith({ role: "operations" }), <WholesalersPage />)
    expect(
      screen.getByText("Toptancıları yalnızca mağaza sahibi ve yöneticiler görebilir.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Toptancılar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Toptan seviyeleri" })).not.toBeInTheDocument()
    expect(listReads()).toHaveLength(0)
  })

  it("puts the wholesale screens among Müşteriler's for owner and admin", async () => {
    serve([account()])
    renderWith(clientWith({ role: "admin" }), <WholesalersPage />)
    expect(await screen.findByRole("link", { name: "Toptancılar" })).toHaveAttribute(
      "href",
      "/customers/wholesale"
    )
    expect(screen.getByRole("link", { name: "Toptan seviyeleri" })).toBeInTheDocument()
  })
})
