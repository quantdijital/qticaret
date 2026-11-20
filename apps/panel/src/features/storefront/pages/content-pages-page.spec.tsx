import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ContentEntry } from "@/features/content/api/content"
import {
  CONTENT_PAGES,
  FULL_PAGES,
  PAGE_LAYOUTS,
} from "@/features/storefront/editor/content-pages.fixtures"
import { DOC, layoutOf } from "@/features/storefront/editor/theme-editor.fixtures"
import { forgetJustMade, isJustMade } from "@/features/storefront/editor/just-made-page"
import type { PageLayout } from "@/features/storefront/api/layout"
import { ContentPagesPage } from "./content-pages-page"

interface Init {
  method?: string
  query?: Record<string, unknown>
  body?: unknown
}

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const navigate = vi.hoisted(() => vi.fn())
const search = vi.hoisted<{ q?: string; page?: number }>(() => ({}))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search: query,
    children,
  }: {
    to: string
    search?: Record<string, string>
    children: ReactNode
  }) => <a href={`${to}${query ? `?${new URLSearchParams(query).toString()}` : ""}`}>{children}</a>,
  getRouteApi: () => ({ useSearch: () => search }),
  useNavigate: () => navigate,
}))

function serve(pages: ContentEntry[], layouts: PageLayout[] = PAGE_LAYOUTS) {
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/content" && init?.method === "POST") {
      return Promise.resolve({ entry: { ...CONTENT_PAGES[2], id: "cnt_yeni" } })
    }
    if (url === "/admin/content") {
      return Promise.resolve({ entries: pages, count: pages.length })
    }
    if (url === "/admin/storefront-layout") {
      return Promise.resolve({ layout: layoutOf({ draft: { ...DOC, pages: layouts } }) })
    }
    return Promise.reject(Object.assign(new Error(`unexpected ${url}`), { status: 404 }))
  })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ContentPagesPage />
    </QueryClientProvider>
  )
}

/** Vitrin > Sayfalar (adr/0073 Ek not 2026-11-20): the shop's pages, opened in the theme editor. */
describe("the storefront's pages list", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    Reflect.deleteProperty(search, "q")
  })

  it("lists the pages with their address, status and last change", async () => {
    serve(CONTENT_PAGES)
    renderPage()
    expect(await screen.findByRole("link", { name: "Hakkımızda" })).toHaveAttribute(
      "href",
      "/storefront/editor?icerik=cnt_hakkimizda"
    )
    expect(fetchMock).toHaveBeenCalledWith("/admin/content", {
      query: { kind: "page", offset: 0, limit: 25 },
    })
    const row = screen.getByRole("link", { name: "İade koşulları" }).closest("tr")
    if (!row) throw new Error("no row")
    expect(row).toHaveTextContent("/iade-kosullari")
    expect(row).toHaveTextContent("Taslak")
    expect(screen.getByRole("link", { name: "Hakkımızda" }).closest("tr")).toHaveTextContent(
      "Yayında"
    )
    expect(screen.queryByText(/en çok 50 sayfa/)).toBeNull()
  })

  it("opens a page in the theme editor from its row", async () => {
    serve(CONTENT_PAGES)
    renderPage()
    const link = await screen.findByRole("link", { name: "İletişim" })
    const row = link.closest("tr")
    if (!row) throw new Error("no row")
    await userEvent.click(within(row).getByText("/iletisim"))
    expect(navigate).toHaveBeenCalledWith({
      to: "/storefront/editor",
      search: { icerik: "cnt_iletisim" },
    })
  })

  it("opens a new page as a draft and takes it to the editor to be written", async () => {
    serve(CONTENT_PAGES)
    renderPage()
    await userEvent.click(screen.getByRole("button", { name: "Yeni sayfa" }))
    const dialog = await screen.findByRole("dialog", { name: "Yeni sayfa" })
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Başlık/ }), "SSS")
    await userEvent.click(within(dialog).getByRole("button", { name: "Oluştur" }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: "/storefront/editor",
        search: { icerik: "cnt_yeni" },
      })
    })
    // Told to the editor in memory, never by the address
    expect(isJustMade("cnt_yeni")).toBe(true)
    forgetJustMade("cnt_yeni")
    expect(fetchMock).toHaveBeenCalledWith("/admin/content", {
      method: "POST",
      body: { kind: "page", title: "SSS" },
    })
  })

  it("says there are none yet, with the way to open one, and when fifty have a layout", async () => {
    serve([], FULL_PAGES)
    renderPage()
    expect(await screen.findByText(/Henüz sayfa yok/)).toBeVisible()
    expect(screen.getAllByRole("button", { name: "Yeni sayfa" })).toHaveLength(2)
    expect(await screen.findByText(/en çok 50 sayfa olabilir/)).toBeVisible()
  })
})
