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
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
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
      entry("merchant", false, "google_platform"),
      entry("indexnow", true),
    ])

    expect(await screen.findByText("4/8 tamam")).toBeInTheDocument()
    expect(screen.queryByText("Mağaza alan adı")).toBeNull()
    expect(screen.getByText("Paylaşım görseli")).toBeInTheDocument()
    expect(screen.getByText("Mağaza künyesi")).toBeInTheDocument()
    expect(screen.getByText(/Önce Google hesabınızı bağlayın/)).toBeInTheDocument()
    // The identity, the share image and Search Console have a way in; the platform's Google does not
    expect(
      screen.getAllByRole("link", { name: /Tamamla/ }).map((link) => link.getAttribute("href"))
    ).toEqual(["/settings/store", "/settings/seo", "/settings/marketing"])
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
