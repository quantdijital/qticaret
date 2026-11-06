import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ContentDetail } from "@/features/content/api/content"
import { PostTermsCard } from "./post-terms-card"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

interface Init {
  method?: string
  body?: unknown
  query?: Record<string, unknown>
}

const view = (id: string, name: string, handle: string, kind: "kategori" | "etiket") => ({
  id,
  name,
  handle,
  path: `/blog/${kind}/${handle}`,
})
const CARE = view("cterm_care", "Bıçak bakımı", "bicak-bakimi", "kategori")
const RECIPES = view("cterm_recipes", "Tarifler", "tarifler", "kategori")
const STEEL = view("cterm_steel", "Çelik", "celik", "etiket")
const DAMASCUS = view("cterm_damascus", "Şam çeliği", "sam-celigi", "etiket")

const POST: ContentDetail = {
  id: "cnt_1",
  kind: "post",
  title: "Bıçak nasıl bilenir",
  handle: "bicak-nasil-bilenir",
  path: "/blog/bicak-nasil-bilenir",
  status: "draft",
  excerpt: null,
  author_name: null,
  image_url: null,
  image_alt: null,
  published_at: null,
  revised_at: null,
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-01T09:00:00Z",
  body: { type: "doc", content: [] },
  category_id: CARE.id,
  tag_ids: [STEEL.id],
  category: CARE,
  tags: [STEEL],
}

const asTerm = (kind: "category" | "tag") => (each: typeof CARE) => ({
  ...each,
  kind,
  description: null,
  rank: 0,
  post_count: 1,
  live_post_count: 0,
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-01T09:00:00Z",
})

function serve() {
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/content/terms" && init?.method === "POST") {
      const { name } = init.body as { name: string }
      return Promise.resolve({ term: asTerm("tag")(view("cterm_new", name, "kamp", "etiket")) })
    }
    if (url === "/admin/content/terms" && init?.query?.["kind"] === "category") {
      return Promise.resolve({ terms: [CARE, RECIPES].map(asTerm("category")), count: 2 })
    }
    if (url === "/admin/content/terms") {
      const asked = init?.query?.["q"]
      const q = typeof asked === "string" ? asked : ""
      const tags = [STEEL, DAMASCUS].filter((tag) =>
        tag.name.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr"))
      )
      return Promise.resolve({ terms: tags.map(asTerm("tag")), count: tags.length })
    }
    if (url === "/admin/content/cnt_1" && init?.method === "POST") {
      return Promise.resolve({ entry: POST })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

// In the page's narrow column: open, its pickers in sight
function renderCard(findings = { count: 0, attention: false }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <PostTermsCard entry={POST} findings={findings} />
    </QueryClientProvider>
  )
}

describe("PostTermsCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    localStorage.clear()
    serve()
  })

  it("shows the category and tags open, with the advisor's findings under them (owner, 2026-11-06)", () => {
    renderCard({ count: 1, attention: false })
    expect(screen.getByRole("heading", { name: "Kategori ve etiketler" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Kategori ve etiketler" })).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Kategori" })).toHaveTextContent("Bıçak bakımı")
    expect(screen.getByText("1 öneri")).toBeInTheDocument()
  })

  it("files the post under another category, an existing tag and a new one, saved with the post", async () => {
    renderCard()
    expect(screen.getByRole("combobox", { name: "Kategori" })).toHaveTextContent("Bıçak bakımı")
    const tags = screen.getByRole("list", { name: "Etiketler" })
    expect(
      within(tags)
        .getAllByRole("listitem")
        .map((tag) => tag.textContent)
    ).toEqual(["Çelik"])

    await userEvent.click(screen.getByRole("combobox", { name: "Kategori" }))
    await userEvent.type(await screen.findByPlaceholderText("Kategori ara"), "tarif")
    await userEvent.click(await screen.findByRole("option", { name: "Tarifler" }))
    expect(screen.getByRole("combobox", { name: "Kategori" })).toHaveTextContent("Tarifler")

    await userEvent.click(screen.getByRole("button", { name: "Etiket ekle" }))
    const search = await screen.findByPlaceholderText("Etiket ara ya da yeni ad yazın")
    await userEvent.type(search, "şam")
    await userEvent.click(await screen.findByRole("option", { name: "Şam çeliği" }))

    await userEvent.type(search, "Kamp")
    await userEvent.click(await screen.findByRole("option", { name: "“Kamp” etiketini oluştur" }))
    await waitFor(() => {
      expect(
        within(tags)
          .getAllByRole("listitem")
          .map((tag) => tag.textContent)
      ).toEqual(["Çelik", "Şam çeliği", "Kamp"])
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/content/terms", {
      method: "POST",
      body: { kind: "tag", name: "Kamp" },
    })

    await userEvent.click(screen.getByRole("button", { name: "Çelik etiketini çıkar" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/content/cnt_1", {
        method: "POST",
        body: { category_id: RECIPES.id, tag_ids: [DAMASCUS.id, "cterm_new"] },
      })
    })
  })

  it("takes the post out of its category", async () => {
    renderCard()

    await userEvent.click(screen.getByRole("combobox", { name: "Kategori" }))
    await userEvent.click(await screen.findByRole("option", { name: "— Kategorisiz —" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/content/cnt_1", {
        method: "POST",
        body: { category_id: null, tag_ids: [STEEL.id] },
      })
    })
  })
})
