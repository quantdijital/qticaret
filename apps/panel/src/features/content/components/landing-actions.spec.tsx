import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LandingDetail } from "@/features/content/api/landings"
import { LandingActions } from "./landing-actions"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))

const LANDING: LandingDetail = {
  id: "lpage_1",
  category_id: "pcat_1",
  facet: { kind: "attribute", key: "malzeme", value: "porselen", label: "Porselen" },
  category: { name: "Kupalar" },
  title: "Porselen kupalar",
  handle: "porselen",
  path: "/kategori/kupalar/porselen",
  status: "draft",
  word_count: 320,
  // Most of its text is another page's: shown red, still the shop's call
  originality: 12,
  reviewed_at: null,
  published_at: null,
  revised_at: null,
  updated_at: "2026-11-04T10:00:00Z",
  body: { type: "doc", content: [] },
  product_count: 3,
}

function renderActions(landing: LandingDetail) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <LandingActions landing={landing} />
    </QueryClientProvider>
  )
}

/** The owner, 2026-11-04: a landing page goes live at one click, whatever its originality. */
describe("LandingActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockResolvedValue({ landing: { ...LANDING, status: "published" } })
  })

  it("publishes a page with little text of its own at once, without a warning or a question", async () => {
    const user = userEvent.setup()
    renderActions(LANDING)

    const publish = screen.getByRole("button", { name: "Yayınla" })
    expect(publish).toBeEnabled()
    expect(publish).not.toHaveAttribute("title")
    await user.click(publish)

    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith("/admin/landings/lpage_1", {
      method: "POST",
      body: { status: "published" },
    })
    expect(toast.success).toHaveBeenCalled()
  })

  it("takes a live page down at once too", async () => {
    const user = userEvent.setup()
    renderActions({ ...LANDING, status: "published", published_at: "2026-11-04T10:00:00Z" })

    await user.click(screen.getByRole("button", { name: "Yayından kaldır" }))

    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith("/admin/landings/lpage_1", {
      method: "POST",
      body: { status: "draft" },
    })
  })
})
