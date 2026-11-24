import { QueryClientProvider } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { MouseEventHandler, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BulkMessageSummary } from "@/features/bulk-messages/api/types"
import { clientWith, counts, summary } from "@/features/bulk-messages/bulk-messages.fixtures"
import { BulkMessagesPage } from "./bulk-messages-page"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const search = vi.hoisted((): { current: Record<string, unknown> } => ({ current: {} }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, onClick }: { children: ReactNode; onClick?: MouseEventHandler }) => (
    <a href="/bulk-messages/bm_1" onClick={onClick}>
      {children}
    </a>
  ),
  getRouteApi: () => ({ useSearch: () => search.current }),
  useNavigate: () => navigate,
}))

const ROWS: BulkMessageSummary[] = [
  summary({
    id: "bm_1",
    name: "Kış indirimi",
    status: "sent",
    started_at: "2026-11-02T09:00:00Z",
    finished_at: "2026-11-02T10:00:00Z",
    counts: counts({ audience: 1500, targeted: 1240, sent: 1236, failed: 4 }),
  }),
  summary({
    id: "bm_2",
    name: "Hafta sonu SMS",
    channel: "sms",
    status: "paused",
    paused_reason: "quiet_hours",
    started_at: "2026-11-03T08:00:00Z",
    counts: counts({ audience: 300, targeted: 280, sent: 100 }),
  }),
  summary({
    id: "bm_3",
    name: "Yeni sezon",
    audience: [{ kind: "newsletter" }, { kind: "all_consented" }],
  }),
]

function serve(rows: BulkMessageSummary[] = ROWS) {
  fetchMock.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
    if (url === "/admin/bulk-messages" && init?.method === "POST") {
      return Promise.resolve({ campaign: { ...summary({ id: "bm_new" }), editable: true } })
    }
    if (url === "/admin/bulk-messages") {
      return Promise.resolve({ campaigns: rows, count: rows.length, limit: 50, offset: 0 })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

function renderPage(client: QueryClient = clientWith()) {
  return render(
    <QueryClientProvider client={client}>
      <BulkMessagesPage />
    </QueryClientProvider>
  )
}

describe("BulkMessagesPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    search.current = {}
    serve()
  })

  it("lists each campaign with its channel, state, audience and sent of target", async () => {
    renderPage()

    const sent = (await screen.findByText("Kış indirimi")).closest("tr")
    expect(sent).not.toBeNull()
    const row = within(sent as HTMLElement)
    expect(row.getByText("E-posta")).toBeInTheDocument()
    expect(row.getByText("Gönderildi")).toBeInTheDocument()
    expect(row.getByText("1.500")).toBeInTheDocument()
    expect(row.getByText("1.236")).toBeInTheDocument()
    expect(row.getByText("/ 1.240")).toBeInTheDocument()
    expect(row.getByText("4 başarısız")).toBeInTheDocument()

    const paused = within(screen.getByText("Hafta sonu SMS").closest("tr") as HTMLElement)
    expect(paused.getByText("SMS")).toBeInTheDocument()
    expect(paused.getByText("Duraklatıldı")).toBeInTheDocument()
    expect(paused.getByText("SMS saatleri dışında")).toBeInTheDocument()
    // A draft counts nobody yet: its sources stand for its audience
    const draft = within(screen.getByText("Yeni sezon").closest("tr") as HTMLElement)
    expect(draft.getByText("2 kaynak")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/bulk-messages", {
      query: { limit: 50, offset: 0 },
    })
  })

  it("filters by state and by channel on the server", async () => {
    search.current = { status: "paused", channel: "sms" }
    serve(ROWS.filter((row) => row.channel === "sms" && row.status === "paused"))
    renderPage()

    expect(await screen.findByText("Hafta sonu SMS")).toBeInTheDocument()
    expect(screen.queryByText("Kış indirimi")).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith("/admin/bulk-messages", {
      query: { status: "paused", channel: "sms", limit: 50, offset: 0 },
    })

    await userEvent.click(screen.getByRole("tab", { name: "Gönderildi" }))
    expect(navigate).toHaveBeenLastCalledWith({
      to: "/bulk-messages",
      search: { status: "sent", channel: "sms", page: undefined },
      replace: true,
    })
  })

  it("asks for the other channel's page when the channel changes, back to its first page", async () => {
    const user = userEvent.setup()
    search.current = { channel: "email", page: 3 }
    renderPage()

    expect(await screen.findByText("Kış indirimi")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/bulk-messages", {
      query: { channel: "email", limit: 50, offset: 100 },
    })

    await user.click(screen.getByRole("combobox", { name: "Kanal" }))
    await user.click(await screen.findByRole("option", { name: "SMS" }))
    expect(navigate).toHaveBeenLastCalledWith({
      to: "/bulk-messages",
      search: { status: undefined, channel: "sms", page: undefined },
      replace: true,
    })
  })

  it("starts a draft by its name and channel and opens it", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Yeni mesaj" }))
    const dialog = await screen.findByRole("dialog")
    await user.type(within(dialog).getByLabelText(/Mesajın adı/), "Hafta sonu")
    await user.click(within(dialog).getByRole("radio", { name: /SMS/ }))
    await user.click(within(dialog).getByRole("button", { name: "Taslağı oluştur" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/bulk-messages", {
        method: "POST",
        body: { name: "Hafta sonu", channel: "sms", audience: [{ kind: "all_consented" }] },
      })
    })
    expect(navigate).toHaveBeenCalledWith({ to: "/bulk-messages/$id", params: { id: "bm_new" } })
  })

  it("says the feature is off instead of asking for a list", () => {
    renderPage(clientWith({ flag: false }))

    expect(screen.getByText(/Toplu e-posta ve SMS bu mağazada kapalı/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Özelliklerden aç" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Yeni mesaj" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("keeps the screen to the owner and admins", () => {
    renderPage(clientWith({ role: "operations" }))

    expect(screen.getByText(/yalnız mağaza sahibi ve yöneticiler/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Yeni mesaj" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
