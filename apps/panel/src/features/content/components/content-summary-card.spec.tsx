import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ContentDetail } from "@/features/content/api/content"
import { ContentSummaryCard } from "./content-summary-card"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: unknown) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const POST: ContentDetail = {
  id: "cnt_1",
  kind: "post",
  title: "Bıçak nasıl bilenir",
  handle: "bicak-nasil-bilenir",
  path: "/blog/bicak-nasil-bilenir",
  status: "draft",
  excerpt: "Bileme taşı, açı ve son dokunuş: evde bıçağı bilemenin adımları.",
  author_name: "Ayşe Usta",
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

function renderCard(entry: ContentDetail, findings = { count: 0, attention: false }) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ContentSummaryCard entry={entry} findings={findings} />
    </QueryClientProvider>
  )
}

/** The owner, 2026-11-06: the summary sits open in the page's narrow column, its length counted. */
describe("ContentSummaryCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    localStorage.clear()
  })

  it("shows a post's summary and author open, with the advisor's findings under them", () => {
    renderCard(POST, { count: 1, attention: false })
    expect(screen.getByRole("heading", { name: "Özet ve yazar" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Özet ve yazar" })).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Özet" })).toHaveValue(POST.excerpt)
    expect(screen.getByRole("textbox", { name: "Yazar" })).toHaveValue("Ayşe Usta")
    expect(screen.getByText("1 öneri")).toBeInTheDocument()
  })

  it("asks a page for its summary only, nothing found said nowhere", () => {
    renderCard({ ...POST, kind: "page", excerpt: null, author_name: null })
    expect(screen.getByRole("heading", { name: "Özet" })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Yazar" })).not.toBeInTheDocument()
    expect(screen.queryByText(/öneri/)).not.toBeInTheDocument()
  })

  it("counts the summary's characters as it is written", async () => {
    renderCard({ ...POST, excerpt: null })
    expect(screen.getByText("0/500")).toBeInTheDocument()
    await userEvent.type(screen.getByRole("textbox", { name: "Özet" }), "Kısa özet")
    expect(screen.getByText("9/500")).toBeInTheDocument()
  })

  it("saves only what changed", async () => {
    fetchMock.mockResolvedValue({ entry: { ...POST, excerpt: "Kısa özet" } })
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
})
