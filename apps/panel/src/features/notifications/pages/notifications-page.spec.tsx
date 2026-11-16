import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { NotificationsPage } from "./notifications-page"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const search = vi.hoisted(() => ({ value: {} }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  getRouteApi: () => ({ useSearch: () => search.value }),
  useNavigate: () => navigate,
}))

type Init = { method?: string; body?: unknown; query?: Record<string, unknown> } | undefined

const alert = (id: string, data: Record<string, unknown>, read = false) => ({
  id,
  created_at: "2026-11-01T09:30:00Z",
  data,
  read,
})

function serve(rows: ReturnType<typeof alert>[], count = rows.length) {
  fetchMock.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/admin/alerts/read"
        ? { ok: true }
        : { notifications: rows, count, unread: rows.filter((row) => !row.read).length }
    )
  )
}

function nth(elements: HTMLElement[], index: number): HTMLElement {
  const element = elements[index]
  if (!element) {
    throw new Error(`no element ${String(index)}`)
  }
  return element
}

const reads = () =>
  (fetchMock.mock.calls as [string, Init][]).filter(([path]) => path === "/admin/alerts/read")

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <NotificationsPage />
    </QueryClientProvider>
  )
}

describe("NotificationsPage (adr/0020)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    search.value = {}
  })

  it("lists the alerts with the unread count on its tab, asking the server for the page", async () => {
    serve([
      alert("noti_1", { kind: "wholesale_order", number: "1201", company: "Kaya Bıçak Ltd" }),
      alert("noti_2", { kind: "low_stock", name: "Kupa", available: 2, threshold: 5 }, true),
    ])
    renderPage()

    expect(await screen.findByText("Yeni toptan sipariş #1201")).toBeInTheDocument()
    expect(screen.getByText("Stok azalıyor: Kupa")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Okunmamış/ })).toHaveTextContent("1")
    expect(fetchMock).toHaveBeenCalledWith("/admin/alerts", {
      query: { state: "all", offset: 0, limit: 25 },
    })
    // Only the unread one offers its own "mark read"
    expect(screen.getAllByRole("button", { name: "Okundu say" })).toHaveLength(1)
  })

  it("asks for the filters and page in the address", async () => {
    search.value = { state: "unread", group: "wholesale", page: 3 }
    serve([], 0)
    renderPage()

    expect(await screen.findByText("Bu görünümde bildirim yok.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/alerts", {
      query: { state: "unread", group: "wholesale", offset: 50, limit: 25 },
    })
  })

  it("puts a tab in the address, back on the first page", async () => {
    search.value = { page: 2 }
    serve([alert("noti_1", { kind: "low_stock", name: "Kupa" })], 40)
    renderPage()

    await userEvent.click(await screen.findByRole("tab", { name: /Okunmamış/ }))
    expect(navigate).toHaveBeenCalledWith({
      to: "/notifications",
      search: { state: "unread", group: undefined, page: undefined },
      replace: true,
    })
  })

  it("marks one, the chosen ones, or all of them read", async () => {
    serve([
      alert("noti_1", { kind: "low_stock", name: "Kupa" }),
      alert("noti_2", { kind: "low_stock", name: "Bardak" }),
    ])
    renderPage()

    const marks = await screen.findAllByRole("button", { name: "Okundu say" })
    await userEvent.click(nth(marks, 0))
    await waitFor(() => {
      expect(reads().at(-1)?.[1]).toEqual({ method: "POST", body: { ids: ["noti_1"] } })
    })

    const boxes = screen.getAllByRole("checkbox", { name: "Bildirimi seç" })
    await userEvent.click(nth(boxes, 0))
    await userEvent.click(nth(boxes, 1))
    expect(screen.getByText("2 bildirim seçildi")).toBeInTheDocument()
    const bar = screen.getByRole("region", { name: "Seçili bildirimler" })
    await userEvent.click(within(bar).getByRole("button", { name: "Okundu say" }))
    await waitFor(() => {
      expect(reads().at(-1)?.[1]).toEqual({ method: "POST", body: { ids: ["noti_1", "noti_2"] } })
    })

    await userEvent.click(screen.getByRole("button", { name: "Tümünü okundu say" }))
    await waitFor(() => {
      expect(reads().at(-1)?.[1]).toEqual({ method: "POST", body: { all: true } })
    })
  })

  it("says so when there are none at all", async () => {
    serve([])
    renderPage()

    expect(await screen.findByText("Henüz bildirim yok.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tümünü okundu say" })).toBeDisabled()
  })
})
