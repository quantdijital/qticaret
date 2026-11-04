import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ReviewRow } from "@/features/reviews/api/reviews"
import { ReviewsPage } from "./reviews-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The page reads its tab from the address; here it is always the waiting ones
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/products">{children}</a>,
  getRouteApi: () => ({ useSearch: () => ({}) }),
  useNavigate: () => vi.fn(),
}))

const row = (id: string, more: Partial<ReviewRow> = {}): ReviewRow => ({
  id,
  rating: 4,
  title: "Keskin",
  body: "Çok keskin, sapı rahat.",
  author_name: "Ayşe Y.",
  customer_id: "cus_1",
  order_id: "order_1",
  origin: "storefront",
  status: "pending",
  has_link: false,
  reject_reason: null,
  created_at: "2026-10-28T10:00:00Z",
  updated_at: "2026-10-28T10:05:00Z",
  product: { id: "prod_1", title: "Şef bıçağı", thumbnail: null },
  photos: [],
  ...more,
})

const PHOTOS = [
  { id: "rph_1", url: "https://cdn.ornek.com/yorum-1.webp", width: 1200, height: 900 },
  { id: "rph_2", url: "https://cdn.ornek.com/yorum-2.webp", width: 900, height: 1200 },
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ReviewsPage />
    </QueryClientProvider>
  )
}

describe("ReviewsPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/admin/product-reviews"
          ? {
              reviews: [row("prev_1"), row("prev_2", { author_name: "Ali V.", has_link: true })],
              count: 2,
            }
          : { moderated: 1, changed: [] }
      )
    )
  })

  it("lists the waiting reviews with their stars, product and a warning for a link", async () => {
    renderPage()

    expect(await screen.findAllByText("Çok keskin, sapı rahat.")).toHaveLength(2)
    expect(screen.getAllByRole("img", { name: "5 üzerinden 4" })).toHaveLength(2)
    expect(screen.getByText("Bağlantı içeriyor")).toBeInTheDocument()
    expect(screen.getAllByText("Şef bıçağı")).toHaveLength(2)
  })

  it("shows a review's photos as thumbnails and opens one larger", async () => {
    fetchMock.mockResolvedValue({ reviews: [row("prev_1", { photos: PHOTOS })], count: 1 })
    renderPage()

    const list = await screen.findByRole("list", { name: "Ayşe Y. yorumundaki fotoğraflar" })
    const thumbnails = within(list).getAllByRole("img")
    expect(thumbnails.map((image) => image.getAttribute("src"))).toEqual([
      "https://cdn.ornek.com/yorum-1.webp",
      "https://cdn.ornek.com/yorum-2.webp",
    ])

    await userEvent.click(
      within(list).getByRole("button", { name: "Ayşe Y. yorumundaki fotoğraf 2" })
    )
    const dialog = await screen.findByRole("dialog", { name: "Ayşe Y. yorumundaki fotoğraf" })
    expect(within(dialog).getByText("2 / 2")).toBeInTheDocument()
    expect(within(dialog).getByRole("img")).toHaveAttribute(
      "src",
      "https://cdn.ornek.com/yorum-2.webp"
    )
  })

  it("approves one review, and rejects the chosen ones together", async () => {
    renderPage()
    await screen.findAllByText("Çok keskin, sapı rahat.")

    const [approveFirst] = screen.getAllByRole("button", { name: "Onayla" })
    if (!approveFirst) {
      throw new Error("no approve button")
    }
    await userEvent.click(approveFirst)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/product-reviews/moderate", {
        method: "POST",
        body: {
          reviews: [{ id: "prev_1", updated_at: "2026-10-28T10:05:00Z" }],
          status: "approved",
        },
      })
    })
    await userEvent.click(screen.getByRole("checkbox", { name: "Ayşe Y. yorumunu seç" }))
    await userEvent.click(screen.getByRole("checkbox", { name: "Ali V. yorumunu seç" }))
    await userEvent.click(screen.getByRole("button", { name: "Seçilenleri reddet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/product-reviews/moderate", {
        method: "POST",
        body: {
          reviews: [
            { id: "prev_1", updated_at: "2026-10-28T10:05:00Z" },
            { id: "prev_2", updated_at: "2026-10-28T10:05:00Z" },
          ],
          status: "rejected",
        },
      })
    })
  })
})
