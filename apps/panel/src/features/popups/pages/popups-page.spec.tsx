import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { MouseEventHandler, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { Popup } from "@/features/popups/api/types"
import { popupFixture } from "@/features/popups/popups.fixtures"
import { PopupsPage } from "./popups-page"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const search = vi.hoisted((): { current: Record<string, unknown> } => ({ current: {} }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, onClick }: { children: ReactNode; onClick?: MouseEventHandler }) => (
    <a href="/popups/popup_1" onClick={onClick}>
      {children}
    </a>
  ),
  getRouteApi: () => ({ useSearch: () => search.current }),
  useNavigate: () => navigate,
}))

const ROWS: Popup[] = [
  popupFixture({
    id: "popup_1",
    name: "Kargo duyurusu",
    starts_at: "2026-11-01T09:00:00Z",
    ends_at: "2026-12-31T20:00:00Z",
    counts: { impressions: 1250, clicks: 84, closes: 300, signups: 0 },
  }),
  popupFixture({
    id: "popup_2",
    name: "Bülten kaydı",
    type: "newsletter",
    is_active: false,
    state: "off",
    counts: { impressions: 40, clicks: 0, closes: 12, signups: 7 },
  }),
  popupFixture({
    id: "popup_3",
    name: "Kış kodu",
    type: "campaign",
    state: "campaign_inactive",
    promotion_id: "promo_1",
    promotion: { id: "promo_1", code: "KIS10", state: "ended" },
  }),
]

function serve({
  rows = ROWS,
  flag = true,
  canWrite = true,
}: { rows?: Popup[]; flag?: boolean; canWrite?: boolean } = {}) {
  fetchMock.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
    if (url === "/admin/features") {
      return Promise.resolve({
        features: [{ key: "marketing.popups", default: true, owner: "tenant", enabled: flag }],
      })
    }
    if (url === "/admin/staff/me") {
      return Promise.resolve({
        user_id: "user_1",
        role: canWrite ? "admin" : "readonly",
        can: { marketing: canWrite, settings: canWrite },
      })
    }
    if (url === "/admin/popups") {
      return Promise.resolve({ popups: rows, count: rows.length, offset: 0, limit: 50 })
    }
    if (url.endsWith("/status") && init?.method === "POST") {
      const body = init.body as { is_active: boolean }
      return Promise.resolve({ popup: { ...rows[1], is_active: body.is_active } })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PopupsPage />
    </QueryClientProvider>
  )
}

describe("PopupsPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    search.current = {}
  })

  it("lists each pop-up with its type, state, dates and counts", async () => {
    serve()
    renderPage()

    const row = (await screen.findByText("Kargo duyurusu")).closest("tr")
    expect(row).not.toBeNull()
    const cells = within(row as HTMLElement)
    expect(cells.getByText("Yayında")).toBeInTheDocument()
    expect(cells.getAllByText("Bilgilendirme").length).toBeGreaterThan(0)
    expect(cells.getByText("1.250")).toBeInTheDocument()
    expect(cells.getByText("84")).toBeInTheDocument()
    expect(screen.getByText("Kapalı")).toBeInTheDocument()
    expect(screen.getByText("Kampanya bitti")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/popups", { query: { offset: 0, limit: 50 } })

    await userEvent.click(screen.getByText("Kış kodu").closest("tr") as HTMLElement)
    expect(navigate).toHaveBeenCalledWith({ to: "/popups/$id", params: { id: "popup_3" } })
  })

  it("turns one on from its row without opening it", async () => {
    serve()
    renderPage()

    await userEvent.click(await screen.findByRole("switch", { name: "Bülten kaydı açık" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/popups/popup_2/status", {
        method: "POST",
        body: { is_active: true },
      })
    })
    expect(navigate).not.toHaveBeenCalled()
  })

  it("filters by type and name through the address", async () => {
    search.current = { type: "newsletter", q: "bülten" }
    serve({ rows: [] })
    renderPage()

    expect(await screen.findByText("Bu seçimle eşleşen pop-up yok.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/popups", {
      query: { q: "bülten", type: "newsletter", offset: 0, limit: 50 },
    })
  })

  it("offers the first pop-up when there is none", async () => {
    serve({ rows: [] })
    renderPage()

    expect(await screen.findByText("Henüz pop-up yok.")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Yeni pop-up" })).toHaveLength(2)
  })

  it("shows the list read-only to a role that may not write", async () => {
    serve({ canWrite: false })
    renderPage()

    expect(await screen.findByText("Kargo duyurusu")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Yeni pop-up" })).toBeNull()
    for (const toggle of screen.getAllByRole("switch")) {
      expect(toggle).toBeDisabled()
    }
  })

  it("says pop-ups are off while the flag is off, and reads none", async () => {
    serve({ flag: false })
    renderPage()

    expect(await screen.findByText(/Pop-up'lar kapalı/)).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Yeni pop-up" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/popups", expect.anything())
  })
})
