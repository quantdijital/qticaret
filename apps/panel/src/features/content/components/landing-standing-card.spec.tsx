import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LandingDetail } from "@/features/content/api/landings"
import { LandingStandingCard } from "./landing-standing-card"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const LANDING: LandingDetail = {
  id: "lpage_1",
  category_id: "pcat_1",
  facet: { kind: "attribute", key: "malzeme", value: "porselen", label: "Porselen" },
  category: { name: "Kupalar" },
  title: "Porselen kupalar",
  handle: "porselen",
  path: "/kategori/kupalar/porselen",
  status: "published",
  word_count: 320,
  originality: 12,
  reviewed_at: null,
  published_at: "2026-11-05T10:00:00Z",
  revised_at: null,
  updated_at: "2026-11-05T10:00:00Z",
  body: { type: "doc", content: [] },
  product_count: 3,
}

const KEPT_OUT = /daha özgün olana kadar arama motorlarına kapalı tutuluyor/

function renderCard(landing: LandingDetail) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <LandingStandingCard landing={landing} />
    </QueryClientProvider>
  )
}

/** adr/0019 Ek 2026-11-05: a live page under 30% stays live, kept out of search, and says so. */
describe("LandingStandingCard", () => {
  it("says a live page under 30% is kept out of search until it is more original", () => {
    renderCard(LANDING)
    expect(screen.getByText(KEPT_OUT)).toBeInTheDocument()
  })

  it.each([
    ["a draft", { status: "draft" as const }],
    ["a live page at 30%", { originality: 30 }],
  ])("says nothing of it for %s", (_label, change) => {
    renderCard({ ...LANDING, ...change })
    expect(screen.queryByText(KEPT_OUT)).not.toBeInTheDocument()
  })
})
