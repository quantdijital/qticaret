import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ContentDetail } from "@/features/content/api/content"
import { AdvisorCard } from "@/features/seo/advisor/advisor-card"
import type { Assessment, SeoIssue } from "@/features/seo/api/advisor"
import { CONTENT_TARGETS, revealContentTarget } from "@/features/content/content-sections"
import { ContentSideCards } from "./content-side-cards"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// Links as plain anchors: the cards are rendered without a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

const POST: ContentDetail = {
  id: "cnt_1",
  kind: "post",
  title: "Bıçak nasıl bilenir",
  handle: "bicak-nasil-bilenir",
  path: "/blog/bicak-nasil-bilenir",
  status: "draft",
  excerpt: "Bileme taşı, açı ve son dokunuş.",
  author_name: null,
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

const ISSUES: SeoIssue[] = [
  {
    ruleId: "A-COVER-01",
    severity: "low",
    category: "images",
    params: { problem: "no_image", count: 0 },
    fix: { kind: "manual", action: "add_image" },
  },
  {
    ruleId: "A-BYLINE-01",
    severity: "medium",
    category: "meta",
    params: {},
    fix: { kind: "manual", action: "edit_author" },
  },
]

// The narrow column as the page draws it: the advisor above the cards
function renderColumn(entry: ContentDetail) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const assessment: Assessment = {
    score: 72,
    grade: "good",
    issues: ISSUES,
    categories: {},
    weights: { structured: 0, meta: 0, images: 0, content: 0, links: 0, technical: 0 },
  }
  client.setQueryData(["seo", "assessment", entry.kind, entry.id, entry.updated_at], assessment)
  render(
    <QueryClientProvider client={client}>
      <AdvisorCard
        kind={entry.kind}
        id={entry.id}
        version={entry.updated_at}
        targets={CONTENT_TARGETS}
        onTarget={revealContentTarget}
      />
      <ContentSideCards entry={entry} />
    </QueryClientProvider>
  )
}

const scrolled = vi.fn<(this: Element, options?: ScrollIntoViewOptions) => void>()

// The layout's width: from `xl` the column follows the scroll beside the text
function setWide(wide: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: wide && query === "(min-width: 80rem)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  })
}

const original = Object.getOwnPropertyDescriptor(window, "matchMedia")

/** The owner, 2026-11-06: a text's cover, summary, category and tags beside it, as a product's cards are. */
describe("ContentSideCards", () => {
  beforeEach(() => {
    localStorage.clear()
    scrolled.mockReset()
    Element.prototype.scrollIntoView = function (this: Element, options) {
      scrolled.call(this, typeof options === "object" ? options : undefined)
    }
  })
  afterEach(() => {
    if (original) {
      Object.defineProperty(window, "matchMedia", original)
    } else {
      Reflect.deleteProperty(window, "matchMedia")
    }
  })

  it("holds a post's cover, summary, category and tags, open, the advisor's findings under each", () => {
    renderColumn(POST)
    const cover = document.getElementById("content-cover-section")
    const summary = document.getElementById("content-summary")
    const terms = document.getElementById("content-terms")
    expect(cover && within(cover).getByRole("heading", { name: "Kapak görseli" })).toBeTruthy()
    expect(cover && within(cover).getByRole("button", { name: /Kapak görseli/ })).toBeTruthy()
    expect(cover && within(cover).getByText("1 öneri")).toBeTruthy()
    expect(summary && within(summary).getByRole("textbox", { name: "Özet" })).toHaveValue(
      POST.excerpt
    )
    expect(summary && within(summary).getByText("1 öneri")).toBeTruthy()
    expect(terms && within(terms).getByRole("combobox", { name: "Kategori" })).toBeTruthy()
    // Nothing on these cards folds: they are short
    for (const title of ["Kapak görseli", "Özet ve yazar", "Kategori ve etiketler"]) {
      expect(screen.queryByRole("button", { name: title })).not.toBeInTheDocument()
    }
  })

  it("gives a page its cover and summary only", () => {
    renderColumn({ ...POST, kind: "page", path: "/sayfa/hakkimizda" })
    expect(document.getElementById("content-cover-section")).toBeInTheDocument()
    expect(document.getElementById("content-summary")).toBeInTheDocument()
    expect(document.getElementById("content-terms")).not.toBeInTheDocument()
  })

  it("brings the cover into the following column's view from the advisor, the page staying put", async () => {
    setWide(true)
    renderColumn(POST)
    // In the assessment's order: the cover, then the byline
    const [toCover] = screen.getAllByRole("button", { name: "Alana git" })
    if (toCover) {
      await userEvent.click(toCover)
    }
    expect(scrolled).toHaveBeenCalledTimes(1)
    expect(scrolled.mock.contexts[0]).toBe(document.getElementById("content-cover-section"))
    expect(scrolled.mock.calls[0]?.[0]).toEqual({ behavior: "smooth", block: "nearest" })
  })

  it("scrolls to the summary's top on a narrow screen, where the column is under the text", async () => {
    setWide(false)
    renderColumn(POST)
    const [, toSummary] = screen.getAllByRole("button", { name: "Alana git" })
    if (toSummary) {
      await userEvent.click(toSummary)
    }
    expect(scrolled.mock.contexts[0]).toBe(document.getElementById("content-summary"))
    expect(scrolled.mock.calls[0]?.[0]).toEqual({ behavior: "smooth", block: "start" })
  })
})
