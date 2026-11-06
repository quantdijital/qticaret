import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { ContentListPage } from "./content-list-page"

interface Init {
  method?: string
  body?: unknown
}

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const navigate = vi.hoisted(() => vi.fn())
const search = vi.hoisted<{ kind?: string; q?: string; page?: number }>(() => ({}))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// Rendered without a router: the address's tab as each test sets it
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  getRouteApi: () => ({ useSearch: () => search }),
  useNavigate: () => navigate,
}))

const AUTHOR = {
  id: "cauth_1",
  name: "Ayşe Usta",
  handle: "ayse-usta",
  path: "/blog/yazar/ayse-usta",
  job_title: null,
  bio: null,
  image_url: null,
  website_url: null,
  linkedin_url: null,
  instagram_url: null,
  x_url: null,
  user_id: null,
  user: null,
  post_count: 1,
  live_post_count: 1,
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-01T09:00:00Z",
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ContentListPage />
    </QueryClientProvider>
  )
}

describe("the content screen's authors tab", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    search.kind = "author"
    fetchMock.mockImplementation((url: string, init?: Init) => {
      if (url === "/admin/content/authors" && init?.method === "POST") {
        return Promise.resolve({ author: { ...AUTHOR, id: "cauth_2", name: "Zeynep Kaya" } })
      }
      if (url === "/admin/content/authors") {
        return Promise.resolve({ authors: [AUTHOR], count: 1 })
      }
      if (url === "/admin/staff") {
        return Promise.resolve({ staff: [], invites: null })
      }
      return Promise.reject(Object.assign(new Error(`unexpected ${url}`), { status: 404 }))
    })
  })

  it("sits beside the blog's categories and tags, its authors listed", async () => {
    renderPage()
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent)
    expect(tabs.indexOf("Yazarlar")).toBe(tabs.indexOf("Etiketler") + 1)
    expect(screen.getByRole("tab", { name: "Yazarlar" })).toHaveAttribute("aria-selected", "true")
    expect(await screen.findByRole("button", { name: "Ayşe Usta" })).toBeInTheDocument()
  })

  it("adds an author from the page's button in the standard dialog", async () => {
    renderPage()
    await userEvent.click(screen.getByRole("button", { name: "Yeni yazar" }))
    const dialog = await screen.findByRole("dialog", { name: "Yeni yazar" })
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Ad soyad/ }), "Zeynep Kaya")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/content/authors", {
        method: "POST",
        body: { name: "Zeynep Kaya" },
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })
})
