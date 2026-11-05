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

const toggle = (name: string) => screen.getByRole("button", { name })

/** The owner, 2026-11-05: the summary folds under the text, saying what is written. */
describe("ContentSummaryCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    localStorage.clear()
  })

  it("says a post's author and summary when folded, with the advisor's findings", () => {
    renderCard(POST, { count: 1, attention: false })
    expect(toggle("Özet ve yazar")).toHaveAttribute("aria-expanded", "false")
    expect(toggle("Özet ve yazar")).toHaveAccessibleDescription(
      "Yazar: Ayşe Usta · Bileme taşı, açı ve son dokunuş: evde bıçağı bilemenin adımları. · 1 öneri"
    )
  })

  it("says a page without a summary uses its text's opening", () => {
    renderCard({ ...POST, kind: "page", excerpt: null, author_name: null })
    expect(toggle("Özet")).toHaveAccessibleDescription("Özet yazılmadı; metnin başı kullanılıyor")
  })

  it("opens for an urgent finding (the post's byline)", () => {
    renderCard({ ...POST, author_name: null }, { count: 1, attention: true })
    expect(toggle("Özet ve yazar")).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("textbox", { name: "Yazar" })).toBeVisible()
  })

  it("keeps an edit while folded and saves only what changed", async () => {
    fetchMock.mockResolvedValue({ entry: { ...POST, excerpt: "Kısa özet" } })
    renderCard(POST)
    await userEvent.click(toggle("Özet ve yazar"))
    await userEvent.clear(screen.getByRole("textbox", { name: "Özet" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Özet" }), "Kısa özet")

    await userEvent.click(toggle("Özet ve yazar"))
    expect(toggle("Özet ve yazar")).toHaveAccessibleDescription("Kaydedilmemiş değişiklik var")

    await userEvent.click(toggle("Özet ve yazar"))
    expect(screen.getByRole("textbox", { name: "Özet" })).toHaveValue("Kısa özet")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/content/cnt_1", {
        method: "POST",
        body: { excerpt: "Kısa özet" },
      })
    })
  })
})
