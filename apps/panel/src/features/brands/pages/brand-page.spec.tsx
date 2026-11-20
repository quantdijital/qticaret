import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { BrandPage } from "./brand-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/brands">{children}</a>,
  getRouteApi: () => ({ useParams: () => ({ id: "brand_1" }) }),
  useNavigate: () => vi.fn(),
}))
// Each card has its own spec; here the page puts them in their places
vi.mock("@/features/seo/advisor/advisor-card", () => ({ AdvisorCard: () => <p>advisor</p> }))
vi.mock("@/features/seo/components/seo-card", () => ({ SeoCard: () => <p>seo</p> }))
vi.mock("@/features/brands/components/brand-general-card", () => ({
  BrandGeneralCard: () => <p>general</p>,
}))
vi.mock("@/features/brands/components/brand-description-card", () => ({
  BrandDescriptionCard: () => <p>description</p>,
}))
vi.mock("@/features/brands/components/brand-logo-card", () => ({
  BrandLogoCard: () => <p>logo</p>,
}))

describe("BrandPage", () => {
  beforeEach(() => {
    fetchMock.mockReset().mockImplementation((url: string) =>
      Promise.resolve(
        url === "/admin/brands/brand_1"
          ? {
              brand: {
                id: "brand_1",
                name: "Ada",
                handle: "ada",
                description: null,
                description_doc: null,
                logo_file_id: null,
                logo_url: null,
                is_active: true,
                product_count: 3,
                created_at: "2026-10-01T00:00:00.000Z",
                updated_at: "2026-10-01T00:00:00.000Z",
              },
            }
          : { values: { url_style: { brand: "nested" } } }
      )
    )
  })

  // The owner (2026-11-20): a long text on the left leaves the side cards in sight
  it("puts the long cards on the left and the advisor and logo in the column that follows the scroll", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BrandPage />
      </QueryClientProvider>
    )
    const side = (await screen.findByText("advisor")).closest("[data-layout-free]")

    expect(side).not.toBeNull()
    expect(side).toContainElement(screen.getByText("logo"))
    for (const card of ["general", "description", "seo"]) {
      expect(side).not.toContainElement(screen.getByText(card))
    }
  })
})
