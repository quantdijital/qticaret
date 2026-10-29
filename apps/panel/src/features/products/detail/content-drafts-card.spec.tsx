import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { ContentDraftsCard } from "./content-drafts-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const answer = (enabled: boolean) => ({
  enabled,
  provider_ready: true,
  quota: { used: 3, limit: 200 },
  drafts: [
    {
      id: "cdraft_1",
      kind: "seo_title",
      text: "Keten Gömlek | Demo Mağaza",
      status: "draft",
      problems: null,
    },
    {
      id: "cdraft_2",
      kind: "seo_description",
      text: "Kısa",
      status: "refused",
      problems: { problems: ["length"] },
    },
  ],
})

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ContentDraftsCard productId="prod_1" />
    </QueryClientProvider>
  )
}

describe("ContentDraftsCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows nothing while the platform has drafts off", async () => {
    fetchMock.mockResolvedValue(answer(false))
    const { container } = renderCard()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(container).toBeEmptyDOMElement()
  })

  it("offers only an open draft to approve, and approves it", async () => {
    fetchMock.mockResolvedValue(answer(true))
    renderCard()
    const approve = await screen.findAllByRole("button", { name: "Onayla ve uygula" })

    expect(approve).toHaveLength(1)
    expect(screen.getByText("Kurallardan geçmedi")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Onayla ve uygula" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/content-drafts/cdraft_1/approve", {
        method: "POST",
      })
    })
  })
})
