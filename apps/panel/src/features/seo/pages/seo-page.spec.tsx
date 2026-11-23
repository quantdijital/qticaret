import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SeoOverview } from "./seo-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

// The cards stand in by name and width: the page decides which are drawn and how wide
const stub = vi.hoisted(() => (name: string) => ({ className }: { className?: string }) => (
  <section aria-label={name} className={className} />
))
vi.mock("@/features/seo/components/search-console-card", () => ({
  SearchConsoleCard: stub("search-console"),
}))
vi.mock("@/features/seo/components/web-vitals-card", () => ({ WebVitalsCard: stub("web-vitals") }))
vi.mock("@/features/seo/components/setup-checklist-card", () => ({
  SetupChecklistCard: stub("setup"),
}))
vi.mock("@/features/seo/components/site-search-card", () => ({ SiteSearchCard: stub("search") }))
vi.mock("@/features/seo/components/sitemap-card", () => ({ SitemapCard: stub("sitemap") }))
vi.mock("@/features/dashboard/components/catalog-health-card", () => ({
  CatalogHealthCard: stub("catalog"),
}))

function renderPage(opened: { search_console: boolean; web_vitals: boolean }) {
  fetchMock.mockImplementation((path: string) =>
    path === "/admin/seo/insights"
      ? Promise.resolve({
          insights: { ...opened, search: null, index: { inspected: 0, indexed: 0 }, vitals: [] },
        })
      : new Promise(() => undefined)
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SeoOverview />
    </QueryClientProvider>
  )
}

const card = (name: string) => screen.queryByRole("region", { name })

describe("SeoOverview", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("sets Search Console and Web Vitals side by side when the platform reads both", async () => {
    renderPage({ search_console: true, web_vitals: true })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/seo/insights")
    })
    expect(card("search-console")?.className).toContain("xl:col-span-7")
    expect(card("web-vitals")?.className).toContain("xl:col-span-5")
  })

  it("leaves Web Vitals out without the platform's CrUX key; Search Console takes the row", async () => {
    renderPage({ search_console: true, web_vitals: false })

    await waitFor(() => {
      expect(card("web-vitals")).toBeNull()
    })
    expect(card("search-console")?.className).toContain("xl:col-span-12")
  })

  it("leaves Search Console out without the platform's Google client; Web Vitals takes the row", async () => {
    renderPage({ search_console: false, web_vitals: true })

    await waitFor(() => {
      expect(card("search-console")).toBeNull()
    })
    expect(card("web-vitals")?.className).toContain("xl:col-span-12")
  })

  it("draws neither while the platform has opened neither", async () => {
    renderPage({ search_console: false, web_vitals: false })

    await waitFor(() => {
      expect(card("search-console")).toBeNull()
    })
    expect(card("web-vitals")).toBeNull()
  })
})
