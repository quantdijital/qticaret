import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { WholesaleTier } from "@/features/wholesale/api/types"
import { clientWith, nth, renderWith, tier } from "@/features/wholesale/wholesale.fixtures"
import { TierPage } from "./tier-page"
import { TiersPage } from "./tiers-page"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  getRouteApi: () => ({ useSearch: () => ({}), useParams: () => ({ id: "wst_1" }) }),
  useNavigate: () => navigate,
}))

type Init = { method?: string; body?: unknown } | undefined

function serve(tiers: WholesaleTier[], write?: (path: string, init: Init) => Promise<unknown>) {
  fetchMock.mockImplementation((path: string, init: Init) => {
    if (init?.method === "POST" || init?.method === "DELETE") {
      return write ? write(path, init) : Promise.resolve({ tier: tier({ id: "wst_new" }) })
    }
    if (path.endsWith("/lines")) {
      return Promise.resolve({
        lines: [],
        count: 0,
        undercut_count: 0,
        rate_zero: { count: 0, variant_ids: [] },
      })
    }
    if (path === "/admin/wholesale/tiers/wst_1") {
      return Promise.resolve({ tier: tiers[0] })
    }
    return Promise.resolve({ tiers, count: tiers.length, limit: 50, offset: 0 })
  })
}

const writes = () =>
  (fetchMock.mock.calls as [string, Init][]).filter(
    ([, init]) => init?.method === "POST" || init?.method === "DELETE"
  )

describe("TiersPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it("lists the levels with their rate and minimum", async () => {
    serve([
      tier(),
      tier({
        id: "wst_2",
        name: "Toptan B",
        percent: null,
        min_quantity: null,
        sync_pending: true,
      }),
    ])
    renderWith(clientWith(), <TiersPage />)
    expect(await screen.findByText("Toptan A")).toBeInTheDocument()
    expect(screen.getByText("%20")).toBeInTheDocument()
    expect(screen.getByText("10 adet")).toBeInTheDocument()
    expect(screen.getByText("Yalnız elle fiyat")).toBeInTheDocument()
    expect(screen.getByText("Fiyatlar güncelleniyor.")).toBeInTheDocument()
  })

  it("opens a new level and goes to its page", async () => {
    serve([])
    renderWith(clientWith(), <TiersPage />)
    expect(await screen.findByText(/^Henüz toptan seviyesi yok/)).toBeInTheDocument()
    await userEvent.click(nth(screen.getAllByRole("button", { name: "Yeni seviye" }), 0))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByLabelText(/^Seviye adı/), "Toptan A")
    await userEvent.type(within(dialog).getByLabelText(/^Bütün ürünlerde indirim oranı/), "15,5")
    await userEvent.click(within(dialog).getByRole("button", { name: "Seviyeyi aç" }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: "/customers/wholesale/tiers/$id",
        params: { id: "wst_new" },
      })
    })
    expect(writes()[0]).toEqual([
      "/admin/wholesale/tiers",
      { method: "POST", body: { name: "Toptan A", percent: 15.5, min_quantity: null } },
    ])
  })

  it("asks for a name", async () => {
    serve([])
    renderWith(clientWith(), <TiersPage />)
    await userEvent.click(nth(await screen.findAllByRole("button", { name: "Yeni seviye" }), 0))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByLabelText(/^Bütün ürünlerde indirim oranı/), "150")
    await userEvent.click(within(dialog).getByRole("button", { name: "Seviyeyi aç" }))
    expect(await within(dialog).findByText("Seviyeye bir ad verin.")).toBeInTheDocument()
    expect(within(dialog).getByText("Oran 0,01 ile 99 arasında olmalı.")).toBeInTheDocument()
    expect(writes()).toHaveLength(0)
  })

  it("is not offered while the shop has wholesale off", () => {
    serve([tier()])
    renderWith(clientWith({ flag: false }), <TiersPage />)
    expect(screen.getByText(/Toptan satış bu mağazada kapalı/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Yeni seviye" })).not.toBeInTheDocument()
  })
})

describe("TierPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it("shows the level's terms and its prices", async () => {
    serve([tier()])
    renderWith(clientWith(), <TierPage />)
    expect(await screen.findByRole("heading", { name: "Toptan A" })).toBeInTheDocument()
    expect(
      screen.getByText("Bütün ürünlerde %20 indirim · Siparişte en az 10 adet")
    ).toBeInTheDocument()
    expect(await screen.findByText("Toptan fiyatlar")).toBeInTheDocument()
  })

  it("says why a level in use is not deleted", async () => {
    const why = "Bu seviyede toptancılar var; önce onları başka bir seviyeye taşıyın."
    serve([tier()], () =>
      Promise.reject(Object.assign(new Error(why), { status: 409, message: why }))
    )
    renderWith(clientWith(), <TierPage />)
    await userEvent.click(await screen.findByRole("button", { name: "Seviyeyi sil" }))
    const confirm = await screen.findByRole("alertdialog")
    await userEvent.click(within(confirm).getByRole("button", { name: "Seviyeyi sil" }))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(why)
    })
    expect(navigate).not.toHaveBeenCalled()
  })
})
