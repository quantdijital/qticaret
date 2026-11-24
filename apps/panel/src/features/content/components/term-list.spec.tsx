import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { Term } from "@/features/content/api/terms"
import { NewTermForm } from "./new-term-form"
import { TermList } from "./term-list"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const storeList = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { store: { list: storeList } } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// ProseMirror cannot lay out in jsdom: the description tab's editor as its label alone
vi.mock("@/features/content/editor/rich-editor", () => ({
  RichEditor: (props: { label: string }) => <output aria-label={props.label} />,
}))

interface Init {
  method?: string
  body?: unknown
  query?: Record<string, unknown>
}

const term = (more: Partial<Term>): Term => ({
  id: "cterm_1",
  kind: "category",
  name: "Bıçak bakımı",
  handle: "bicak-bakimi",
  path: "/blog/kategori/bicak-bakimi",
  description: null,
  description_doc: null,
  rank: 0,
  post_count: 3,
  live_post_count: 2,
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-01T09:00:00Z",
  ...more,
})

const CARE = term({})
const RECIPES = term({
  id: "cterm_2",
  name: "Tarifler",
  handle: "tarifler",
  path: "/blog/kategori/tarifler",
  rank: 1,
  post_count: 0,
  live_post_count: 0,
})
const NO_SEO = {
  seo_title: null,
  seo_description: null,
  focus_keyword: null,
  canonical_override: null,
  robots_override: null,
  og_image_override: null,
  og_image_alt: null,
}

function serve() {
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/content/terms" && init?.method === "POST") {
      const body = init.body as { name: string }
      return Promise.resolve({ term: term({ id: "cterm_9", name: body.name }) })
    }
    if (url === "/admin/content/terms") {
      return Promise.resolve({ terms: [CARE, RECIPES], count: 2 })
    }
    if (url === "/admin/content/terms/cterm_1" && init?.method === "POST") {
      return Promise.resolve({ term: { ...CARE, ...(init.body as object) } })
    }
    if (url === "/admin/content/terms/cterm_1" && init?.method === "DELETE") {
      return Promise.resolve({ id: "cterm_1", deleted: true, unlinked: 3 })
    }
    if (url === "/admin/seo/post_category/cterm_1") {
      return Promise.resolve({ seo: NO_SEO })
    }
    if (url === "/admin/content") {
      return Promise.resolve({ entries: [], count: 0 })
    }
    return Promise.reject(Object.assign(new Error(`unexpected ${url}`), { status: 404 }))
  })
  storeList.mockResolvedValue({ stores: [{ id: "store_1", name: "Bıçakçı" }] })
}

const calls = (url: string, method: string) =>
  fetchMock.mock.calls.filter(([to, init]) => to === url && init?.method === method)

function renderTerms() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <NewTermForm kind="category" />
      <TermList kind="category" q="" page={0} onPage={vi.fn()} />
    </QueryClientProvider>
  )
}

describe("blog categories", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    serve()
  })

  it("lists them in the shop's order with their address and post counts", async () => {
    renderTerms()

    await screen.findByRole("button", { name: "Tarifler" })
    const rows = screen.getAllByRole("row")
    expect(rows.slice(1).map((row) => row.textContent)).toEqual([
      "Bıçak bakımı/blog/kategori/bicak-bakimi32 yayında0",
      "Tarifler/blog/kategori/tarifler00 yayında1",
    ])
    expect(fetchMock).toHaveBeenCalledWith("/admin/content/terms", {
      query: { kind: "category", offset: 0, limit: 50 },
    })
  })

  it("adds one by its name, showing the address it will get", async () => {
    renderTerms()
    const name = screen.getByRole("textbox", { name: "Yeni kategori adı" })

    await userEvent.type(name, "Şef Bıçakları")
    expect(screen.getByText("Adresi: /blog/kategori/sef-bicaklari")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }))

    await waitFor(() => {
      expect(calls("/admin/content/terms", "POST")).toEqual([
        [
          "/admin/content/terms",
          { method: "POST", body: { kind: "category", name: "Şef Bıçakları" } },
        ],
      ])
    })
    expect(name).toHaveValue("")
  })

  it("edits one in a sheet, sending only what changed", async () => {
    renderTerms()
    await userEvent.click(await screen.findByRole("button", { name: "Bıçak bakımı" }))
    const sheet = await screen.findByRole("dialog", { name: "Bıçak bakımı" })

    // Its text is on a tab of its own (adr/0075 Ek 2026-11-24), not a field of this form
    expect(within(sheet).queryByRole("textbox", { name: "Açıklama" })).toBeNull()
    expect(within(sheet).getByRole("tab", { name: "Açıklama" })).toBeInTheDocument()
    const rank = within(sheet).getByRole("spinbutton", { name: "Sıra" })
    await userEvent.clear(rank)
    await userEvent.type(rank, "5")
    // The general tab's own Save (the description tab, kept mounted, has its own)
    const form = rank.closest("form")
    if (!form) {
      throw new Error("no form")
    }
    await userEvent.click(within(form).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(calls("/admin/content/terms/cterm_1", "POST")).toEqual([
        [
          "/admin/content/terms/cterm_1",
          {
            method: "POST",
            body: { rank: 5 },
          },
        ],
      ])
    })

    // Its archive's search appearance is a tab of its own, on the SEO fields' own address
    await userEvent.click(within(sheet).getByRole("tab", { name: "Arama görünümü" }))
    expect(await within(sheet).findByText("Arama motoru görünümü")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/seo/post_category/cterm_1")
  })

  it("deletes one after saying its posts stay", async () => {
    renderTerms()
    await userEvent.click(await screen.findByRole("button", { name: "Bıçak bakımı" }))
    const sheet = await screen.findByRole("dialog", { name: "Bıçak bakımı" })
    await userEvent.click(within(sheet).getByRole("button", { name: "Kategoriyi sil" }))

    const confirm = await screen.findByRole("alertdialog", { name: "“Bıçak bakımı” silinsin mi?" })
    expect(confirm).toHaveTextContent("Kategorideki 3 yazı silinmez, kategorisiz kalır.")
    await userEvent.click(within(confirm).getByRole("button", { name: "Kategoriyi sil" }))

    await waitFor(() => {
      expect(calls("/admin/content/terms/cterm_1", "DELETE")).toHaveLength(1)
    })
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Bıçak bakımı" })).toBeNull()
    })
  })
})
