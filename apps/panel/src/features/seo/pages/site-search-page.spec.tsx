import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { SynonymGroup } from "@/features/seo/api/synonyms"
import { SiteSearchPage } from "./site-search-page"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const staff = vi.hoisted(() => ({ catalog: true }))
const search = vi.hoisted<{ q?: string; page?: number }>(() => ({}))
const navigate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: (capability: string) => capability === "catalog" && staff.catalog,
}))
// Links as plain anchors, the address's search as each test sets it: rendered without a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  getRouteApi: () => ({ useSearch: () => search }),
  useNavigate: () => navigate,
}))

const KNIFE: SynonymGroup = {
  id: "ssyn_1",
  terms: ["çakı", "bıçak"],
  created_at: "2026-11-03T09:00:00.000Z",
  updated_at: "2026-11-03T10:00:00.000Z",
}
const SHIRT: SynonymGroup = {
  id: "ssyn_2",
  terms: ["tişört", "t shirt", "tshirt"],
  created_at: "2026-11-02T09:00:00.000Z",
  updated_at: "2026-11-02T09:00:00.000Z",
}
const GROUPS = [KNIFE, SHIRT]

function answers(groups: SynonymGroup[] = GROUPS) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    if (init?.method === "DELETE") {
      return Promise.resolve({ id: "ssyn_1", object: "search_synonym", deleted: true })
    }
    if (init?.method === "POST") {
      return Promise.resolve({ synonym: groups[0] })
    }
    return Promise.resolve({ synonyms: groups, count: groups.length, offset: 0, limit: 25 })
  })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SiteSearchPage />
    </QueryClientProvider>
  )
}

const row = (term: string) => {
  const cell = screen.getByText(term).closest("tr")
  if (!cell) {
    throw new Error(`no row for ${term}`)
  }
  return cell
}

describe("SiteSearchPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toast.success.mockReset()
    navigate.mockReset()
    staff.catalog = true
    delete search.q
    delete search.page
  })

  it("lists the groups, their terms side by side and when each changed", async () => {
    answers()
    renderPage()
    expect(await screen.findByText("tişört")).toBeInTheDocument()
    expect(within(row("çakı")).getByText("bıçak")).toBeInTheDocument()
    expect(within(row("tişört")).getAllByRole("listitem")).toHaveLength(3)
    expect(within(row("çakı")).getByText("3 Kas 2026")).toBeInTheDocument()
    expect(screen.getByText("2 / 1.000 grup")).toBeInTheDocument()
    expect(screen.getByText(/“çakı” arayan “bıçak” ürünlerini de bulur/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/search/synonyms", {
      query: { offset: 0, limit: 25 },
    })
  })

  it("searches the terms from the address, a page at a time", async () => {
    search.q = "tisort"
    search.page = 2
    answers([SHIRT])
    renderPage()
    expect(await screen.findByText("1 grup bulundu")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/search/synonyms", {
      query: { offset: 25, limit: 25, q: "tisort" },
    })
  })

  it("says so when nothing is there yet, with the way to add the first group", async () => {
    answers([])
    renderPage()
    expect(await screen.findByText(/Henüz eş anlamlı grup yok/)).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Grup ekle" })).toHaveLength(2)
  })

  it("edits a group from its row and deletes one behind a confirmation", async () => {
    answers()
    renderPage()
    await screen.findByText("tişört")

    await userEvent.click(screen.getByRole("button", { name: "çakı, bıçak için işlemler" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Düzenle" }))
    const dialog = await screen.findByRole("dialog", { name: "Eş anlamlı grubu düzenle" })
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Terimler" }), "kama{Enter}")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/search/synonyms/ssyn_1", {
        method: "POST",
        body: { terms: ["çakı", "bıçak", "kama"] },
      })
    })

    await userEvent.click(screen.getByRole("button", { name: "çakı, bıçak için işlemler" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Sil" }))
    const confirm = await screen.findByRole("alertdialog", { name: "Eş anlamlı grup silinsin mi?" })
    expect(confirm).toHaveTextContent("“çakı, bıçak” grubu silinir")
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/search/synonyms/ssyn_1", {
      method: "DELETE",
    })
    await userEvent.click(within(confirm).getByRole("button", { name: "Grubu sil" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/search/synonyms/ssyn_1", {
        method: "DELETE",
      })
    })
    expect(toast.success).toHaveBeenCalledWith("Eş anlamlı grup silindi.")
  })

  it("shows a role that only reads the groups, without a way to change them", async () => {
    staff.catalog = false
    answers()
    renderPage()
    expect(await screen.findByText("tişört")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Eş anlamlı grupları mağaza sahibi ve yöneticiler değiştirebilir; siz görüntülüyorsunuz."
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Grup ekle" })).toBeNull()
    expect(screen.queryByRole("button", { name: /için işlemler$/ })).toBeNull()
    // A row opens nothing
    await userEvent.click(screen.getByText("tişört"))
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
