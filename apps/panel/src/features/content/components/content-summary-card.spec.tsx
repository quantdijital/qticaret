import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { Author } from "@/features/content/api/authors"
import type { ContentDetail } from "@/features/content/api/content"
import { ContentSummaryCard } from "./content-summary-card"

interface Init {
  method?: string
  body?: unknown
  query?: Record<string, unknown>
}

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const author = (more: Partial<Author>): Author => ({
  id: "cauth_1",
  name: "Ayşe Usta",
  handle: "ayse-usta",
  path: "/blog/yazar/ayse-usta",
  job_title: "Bıçak ustası",
  bio: null,
  image_url: null,
  website_url: null,
  linkedin_url: null,
  instagram_url: null,
  x_url: null,
  user_id: null,
  user: null,
  post_count: 2,
  live_post_count: 1,
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-01T09:00:00Z",
  ...more,
})

const AYSE = author({})
const MEHMET = author({
  id: "cauth_2",
  name: "Mehmet Şef",
  handle: "mehmet-sef",
  path: "/blog/yazar/mehmet-sef",
  job_title: null,
})

const POST: ContentDetail = {
  id: "cnt_1",
  kind: "post",
  title: "Bıçak nasıl bilenir",
  handle: "bicak-nasil-bilenir",
  path: "/blog/bicak-nasil-bilenir",
  status: "draft",
  excerpt: "Bileme taşı, açı ve son dokunuş: evde bıçağı bilemenin adımları.",
  author_name: "Ayşe Usta",
  author_id: "cauth_1",
  author: { id: "cauth_1", name: "Ayşe Usta", handle: "ayse-usta", path: "/blog/yazar/ayse-usta" },
  image_url: null,
  image_alt: null,
  published_at: null,
  revised_at: null,
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-01T09:00:00Z",
  body: { type: "doc", content: [] },
  category_id: null,
  tag_ids: [],
  category: null,
  tags: [],
}

function serve() {
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/content/authors" && init?.method === "POST") {
      const body = init.body as { name: string }
      return Promise.resolve({ author: author({ id: "cauth_9", name: body.name }) })
    }
    if (url === "/admin/content/authors") {
      return Promise.resolve({ authors: [AYSE, MEHMET], count: 2 })
    }
    if (url === "/admin/content/cnt_1") {
      return Promise.resolve({ entry: POST })
    }
    if (url === "/admin/staff") {
      return Promise.resolve({ staff: [], invites: null })
    }
    return Promise.reject(Object.assign(new Error(`unexpected ${url}`), { status: 404 }))
  })
}

function renderCard(entry: ContentDetail, findings = { count: 0, attention: false }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ContentSummaryCard entry={entry} findings={findings} />
    </QueryClientProvider>
  )
}

const saves = () =>
  fetchMock.mock.calls.filter(([to, init]) => to === "/admin/content/cnt_1" && init?.method)

/** The owner, 2026-11-06: the summary sits open in the page's narrow column, its length counted. */
describe("ContentSummaryCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    serve()
    localStorage.clear()
  })

  it("shows a post's summary and chosen author open, with the advisor's findings under them", () => {
    renderCard(POST, { count: 1, attention: false })
    expect(screen.getByRole("heading", { name: "Özet ve yazar" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Özet ve yazar" })).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Özet" })).toHaveValue(POST.excerpt)
    expect(screen.getByRole("combobox", { name: "Yazar" })).toHaveTextContent("Ayşe Usta")
    expect(screen.queryByText(/Eski yazar adı/)).not.toBeInTheDocument()
    expect(screen.getByText("1 öneri")).toBeInTheDocument()
  })

  it("asks a page for its summary only, nothing found said nowhere", () => {
    renderCard({ ...POST, kind: "page", excerpt: null, author_name: null, author: null })
    expect(screen.getByRole("heading", { name: "Özet" })).toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Yazar" })).not.toBeInTheDocument()
    expect(screen.queryByText(/öneri/)).not.toBeInTheDocument()
  })

  it("counts the summary's characters as it is written", async () => {
    renderCard({ ...POST, excerpt: null })
    expect(screen.getByText("0/500")).toBeInTheDocument()
    await userEvent.type(screen.getByRole("textbox", { name: "Özet" }), "Kısa özet")
    expect(screen.getByText("9/500")).toBeInTheDocument()
  })

  it("saves only what changed", async () => {
    renderCard(POST)
    await userEvent.clear(screen.getByRole("textbox", { name: "Özet" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Özet" }), "Kısa özet")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/content/cnt_1", {
        method: "POST",
        body: { excerpt: "Kısa özet" },
      })
    })
  })

  it("chooses the author from the blog's authors, searched by name", async () => {
    renderCard(POST)
    await userEvent.click(screen.getByRole("combobox", { name: "Yazar" }))
    await userEvent.click(await screen.findByRole("option", { name: /Mehmet Şef/ }))
    expect(screen.getByRole("combobox", { name: "Yazar" })).toHaveTextContent("Mehmet Şef")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(saves()).toEqual([
        ["/admin/content/cnt_1", { method: "POST", body: { author_id: "cauth_2" } }],
      ])
    })
  })

  it("clears the author", async () => {
    renderCard(POST)
    await userEvent.click(screen.getByRole("button", { name: "Temizle" }))
    expect(screen.getByRole("combobox", { name: "Yazar" })).toHaveTextContent("Yazar seçin")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(saves()).toEqual([
        ["/admin/content/cnt_1", { method: "POST", body: { author_id: null } }],
      ])
    })
  })

  it("makes a new author in the author's dialog and chooses them, the card's own save apart", async () => {
    renderCard({ ...POST, author_id: null, author: null, author_name: null })
    await userEvent.click(screen.getByRole("button", { name: "Yeni yazar" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Ad soyad/ }), "Zeynep Kaya")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    const made = fetchMock.mock.calls.filter(
      ([to, init]) => to === "/admin/content/authors" && init?.method === "POST"
    )
    expect(made).toEqual([
      ["/admin/content/authors", { method: "POST", body: { name: "Zeynep Kaya" } }],
    ])
    // Chosen, not yet saved on the post
    expect(saves()).toEqual([])
    expect(screen.getByRole("combobox", { name: "Yazar" })).toHaveTextContent("Zeynep Kaya")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(saves()).toEqual([
        ["/admin/content/cnt_1", { method: "POST", body: { author_id: "cauth_9" } }],
      ])
    })
  })

  it("names a post's old typed-in author and makes it an author in one click", async () => {
    renderCard({ ...POST, author_id: null, author: null, author_name: "Ayşe Usta" })
    expect(screen.getByText(/Eski yazar adı: Ayşe Usta/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "yeni yazar olarak ekleyin" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("textbox", { name: /Ad soyad/ })).toHaveValue("Ayşe Usta")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Yazar" })).toHaveTextContent("Ayşe Usta")
    })
    expect(screen.queryByText(/Eski yazar adı/)).not.toBeInTheDocument()
  })
})
