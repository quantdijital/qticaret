import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { SeoSetupEntry } from "@/features/seo/api/setup"
import { SetupChecklistCard } from "./setup-checklist-card"

const fetchMock = vi.hoisted(() => vi.fn())
const reach = vi.hoisted(() => ({ settings: true }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => reach.settings }))
// A link as an anchor with its search in the address: rendered without a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
  }: {
    to: string
    search?: Record<string, string>
    children: ReactNode
  }) => <a href={search ? `${to}?${new URLSearchParams(search).toString()}` : to}>{children}</a>,
}))

const entry = (
  key: SeoSetupEntry["key"],
  done: boolean,
  blocked: SeoSetupEntry["blocked"] = null
) => ({ key, done, blocked }) satisfies SeoSetupEntry

function renderCard(items: SeoSetupEntry[]) {
  fetchMock.mockResolvedValue({ items })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SetupChecklistCard />
    </QueryClientProvider>
  )
}

describe("SetupChecklistCard", () => {
  beforeEach(() => {
    reach.settings = true
  })

  it("lists only what is missing, each with where it is done or what holds it", async () => {
    renderCard([
      entry("legal_identity", false),
      entry("legal_texts", true),
      entry("canonical_host", true),
      entry("robots", true),
      entry("share_image", false),
      entry("search_console", false, "google_account"),
      entry("merchant", false, "google_account"),
      entry("indexnow", true),
    ])

    expect(await screen.findByText("4/8 tamam")).toBeInTheDocument()
    expect(screen.queryByText("Mağaza alan adı")).toBeNull()
    expect(screen.getByText("Paylaşım görseli")).toBeInTheDocument()
    expect(screen.getByText("Mağaza künyesi")).toBeInTheDocument()
    expect(screen.getAllByText(/Önce Google hesabınızı bağlayın/)).toHaveLength(2)
    // Every open item has its way in: Google's are listed only once the platform has opened it
    expect(
      screen.getAllByRole("link", { name: /Tamamla/ }).map((link) => link.getAttribute("href"))
    ).toEqual([
      "/settings/store?part=legal",
      "/settings/seo",
      "/settings/marketing",
      "/settings/marketing",
    ])
  })

  it("shows staff who cannot change settings what is missing, not the way in", async () => {
    reach.settings = false
    renderCard([entry("share_image", false)])

    expect(await screen.findByText("Paylaşım görseli")).toBeInTheDocument()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("is gone once everything is done", async () => {
    const { container } = renderCard([entry("canonical_host", true)])

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(container).toBeEmptyDOMElement()
  })
})
