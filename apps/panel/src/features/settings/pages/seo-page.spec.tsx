import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SeoPage } from "./seo-page"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const address = vi.hoisted<{ search: Record<string, unknown> }>(() => ({ search: {} }))
// What the signed-in role may (adr/0040): the owner unless a test says otherwise
const staff = vi.hoisted(() => ({ settings: true }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@/features/auth/api/staff", () => ({
  useCapabilities: () => (capability: string) => capability !== "settings" || staff.settings,
}))
// Links as plain anchors with their query, the address from the test: rendered without a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
    className,
  }: {
    to: string
    search?: Record<string, string>
    children: ReactNode
    className?: string
  }) => (
    <a href={search ? `${to}?${new URLSearchParams(search).toString()}` : to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
  useSearch: () => address.search,
}))

// Each tab's body stands in by name: the page decides which tabs there are and what they say
const stub = vi.hoisted(() => (name: string) => () => <section aria-label={name} />)
vi.mock("@/features/seo/pages/seo-page", () => ({ SeoOverview: stub("overview") }))
vi.mock("@/features/seo/pages/redirects-page", () => ({ RedirectsTab: stub("redirects") }))
vi.mock("@/features/seo/pages/site-search-page", () => ({ SiteSearchTab: stub("site-search") }))
vi.mock("@/features/seo/advisor/summary-card", () => ({ AdvisorSummaryCard: stub("advisor") }))
vi.mock("@/features/seo/audit/audit-card", () => ({ AuditCard: stub("audit") }))
vi.mock("@/features/settings/components/seo-settings-cards", () => ({
  SeoAddressesPart: stub("addresses"),
  SeoPagesPart: stub("pages"),
  SeoSearchPart: stub("search"),
}))

const SUMMARY = {
  products: 40,
  average: 72,
  grades: { excellent: 10, good: 15, needs_work: 10, poor: 5 },
  critical: 3,
  lowest: [],
}

function answers() {
  fetchMock.mockImplementation((path: string) => {
    switch (path) {
      case "/admin/seo/setup":
        return Promise.resolve({
          items: [
            { key: "canonical_host", done: false, blocked: null },
            { key: "robots", done: true, blocked: null },
            { key: "share_image", done: false, blocked: null },
          ],
        })
      case "/admin/seo/assessments/summary":
        return Promise.resolve(SUMMARY)
      case "/admin/seo/audit":
        return Promise.resolve({
          audit: {
            latest: null,
            report: {
              id: "job_1",
              created_at: "2026-11-22T02:00:00.000Z",
              finished_at: "2026-11-22T02:05:00.000Z",
              has_file: true,
              findings: [
                { ruleId: "S-404-01", severity: "high", count: 4, items: [] },
                { ruleId: "S-IMG-01", severity: "medium", count: 9, items: [] },
                { ruleId: "S-DUP-01", severity: "low", count: 2, items: [] },
                { ruleId: "S-ORPHAN-01", severity: "low", count: 1, items: [] },
              ],
            },
          },
        })
      case "/admin/seo/not-found":
        return Promise.resolve({ count: 5 })
      default:
        return Promise.resolve({ count: 0 })
    }
  })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SeoPage />
    </QueryClientProvider>
  )
}

const tabNames = () => screen.getAllByRole("tab").map((tab) => tab.textContent)

describe("Settings > SEO, the shop's one SEO home (the owner, 2026-11-23)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockClear()
    address.search = {}
    staff.settings = true
    answers()
  })

  it("holds the daily work first and the settings after, what waits counted on each tab", async () => {
    renderPage()

    expect(await screen.findByRole("tab", { name: "Öneriler 3" })).toBeInTheDocument()
    expect(await screen.findByRole("tab", { name: "Yönlendirmeler 5" })).toBeInTheDocument()
    expect(await screen.findByRole("tab", { name: "Denetim 4" })).toBeInTheDocument()
    expect(tabNames()).toEqual([
      "Genel bakış 2",
      "Öneriler 3",
      "Denetim 4",
      "Yönlendirmeler 5",
      "Site araması",
      "Adresler",
      "Başlıklar ve görsel",
      "Arama motorları",
    ])
    // The overview opens first
    expect(screen.getByRole("region", { name: "overview" })).toBeInTheDocument()
  })

  it("shows the shop's score in the header, one click from the suggestions", async () => {
    renderPage()

    const score = await screen.findByRole("link", { name: /Mağaza SEO puanı/ })
    expect(score).toHaveAttribute("href", "/settings/seo?part=advisor")
    expect(within(score).getByText("3 üründe kritik eksik")).toBeInTheDocument()
    expect(within(score).getByRole("img", { name: "SEO puanı 72/100" })).toBeInTheDocument()
  })

  it("opens the tab the address names", () => {
    address.search = { part: "redirects", tab: "missing", q: "kupa" }
    renderPage()

    expect(screen.getByRole("region", { name: "redirects" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /^Yönlendirmeler/ })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })

  it("leaves a tab's filters behind when another opens", async () => {
    address.search = { part: "redirects", tab: "missing", q: "kupa", page: 2 }
    renderPage()

    await userEvent.click(screen.getByRole("tab", { name: "Site araması" }))

    expect(navigate).toHaveBeenCalledWith({
      to: "/settings/seo",
      search: { part: "site-search" },
      replace: true,
      resetScroll: false,
    })
  })

  it("keeps the work tabs for a role without settings, as under Pazarlama before", async () => {
    staff.settings = false
    renderPage()

    await screen.findByRole("tab", { name: "Öneriler 3" })
    expect(tabNames().map((name) => name.replace(/ \d+$/, ""))).toEqual([
      "Genel bakış",
      "Öneriler",
      "Denetim",
      "Yönlendirmeler",
      "Site araması",
    ])
  })
})
