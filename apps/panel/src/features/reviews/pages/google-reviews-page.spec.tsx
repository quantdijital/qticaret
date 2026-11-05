import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { GoogleReviewsStatus } from "@/features/reviews/api/google-reviews"
import { GoogleReviewsPage } from "./google-reviews-page"

const fetchMock = vi.hoisted(() => vi.fn())
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: toastMock }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/reviews">{children}</a>,
  getRouteApi: () => ({ useSearch: () => ({}) }),
  useNavigate: () => vi.fn(),
}))

const status = (
  more: Partial<GoogleReviewsStatus> = {}
): { google_reviews: GoogleReviewsStatus } => ({
  google_reviews: {
    configured: true,
    connected: true,
    granted: true,
    location: {
      account: "accounts/1",
      location: "locations/2",
      title: "Bıçak Atölyesi",
      address: "Saraylar Mah., Merkezefendi, Denizli",
      maps_url: "https://maps.google.com/maps?cid=1",
    },
    rating: 4.6,
    count: 16,
    synced_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    error: null,
    ...more,
  },
})

const REVIEWS = {
  reviews: [
    {
      id: "grev_1",
      author: "Mehmet Kaya",
      rating: 5,
      comment: "Şam çeliği av bıçağı aldım.",
      created_at: "2026-11-02T10:00:00Z",
      replied: true,
      hidden: false,
      hidden_reason: null,
      hidden_by: null,
      hidden_at: null,
    },
    {
      id: "grev_2",
      author: null,
      rating: 4,
      comment: null,
      created_at: "2026-10-20T10:00:00Z",
      replied: false,
      hidden: true,
      hidden_reason: "personal_data",
      hidden_by: "Ayşe Yılmaz",
      hidden_at: "2026-11-04T09:30:00Z",
    },
  ],
  count: 2,
}

function answer(
  google: { google_reviews: GoogleReviewsStatus },
  extra: Record<string, unknown> = {}
) {
  fetchMock.mockImplementation((path: string) => {
    if (path in extra) {
      return Promise.resolve(extra[path])
    }
    if (path === "/admin/google/reviews") {
      return Promise.resolve(google)
    }
    if (path === "/admin/google/reviews/items") {
      return Promise.resolve(REVIEWS)
    }
    return Promise.resolve({})
  })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <GoogleReviewsPage />
    </QueryClientProvider>
  )
}

describe("GoogleReviewsPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
    window.history.replaceState(null, "", "/reviews/google")
  })

  it("says in a line that Google is not set up, and offers nothing (docs/06 principle 10)", async () => {
    answer(status({ configured: false, connected: false, granted: false, location: null }))
    renderPage()

    expect(
      await screen.findByText("Google bağlantısı bu mağaza için henüz kurulmadı.")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Google yorumlarını bağla" })
    ).not.toBeInTheDocument()
  })

  it("sends a shop connected without Business Profile to Google's screen for it", async () => {
    const assign = vi.fn()
    vi.stubGlobal("location", { assign, search: "", pathname: "/reviews/google" })
    answer(status({ granted: false, location: null }), {
      "/admin/google/reviews/connect": { url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" },
    })
    renderPage()

    expect(await screen.findByText(/İşletme Profili izni verilmemiş/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Google yorumlarını bağla" }))

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?x=1")
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/google/reviews/connect", { method: "POST" })
    vi.unstubAllGlobals()
  })

  it("picks the location from those the account manages, the only one chosen already", async () => {
    answer(status({ location: null, rating: null, count: null, synced_at: null }), {
      "/admin/google/reviews/locations": {
        locations: [
          {
            account: "accounts/1",
            location: "locations/2",
            title: "Bıçak Atölyesi",
            address: null,
          },
        ],
      },
      "/admin/google/reviews/location": { sync: { error: null } },
    })
    renderPage()

    await userEvent.click(await screen.findByRole("button", { name: "Bu konumu kullan" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/google/reviews/location", {
        method: "POST",
        body: { account: "accounts/1", location: "locations/2" },
      })
    })
    expect(toastMock.success).toHaveBeenCalledWith("Konum kaydedildi, yorumlar Google'dan okundu.")
  })

  it("shows Google's figures in a line, the reviews, and a hidden one's reason, who and when", async () => {
    answer(status())
    renderPage()

    expect(await screen.findByText(/Google'da 4,6 · 16 yorum · son eşitleme/)).toBeInTheDocument()
    expect(screen.getByText("Bıçak Atölyesi")).toBeInTheDocument()
    expect(await screen.findByText("Şam çeliği av bıçağı aldım.")).toBeInTheDocument()
    expect(screen.getByText("Yanıtlandı")).toBeInTheDocument()
    expect(screen.getByText("Yalnızca puan verilmiş.")).toBeInTheDocument()
    expect(screen.getByText("Vitrinden kaldırıldı")).toBeInTheDocument()
    expect(screen.getByText(/Gerekçe: Kişisel veri içeriyor · Ayşe Yılmaz/)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Mehmet Kaya yorumunu vitrinden kaldır" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Vitrine geri al" })).toBeInTheDocument()
    // No switch to flip, no way to pick many
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("takes a review off only after one of the three reasons is chosen", async () => {
    answer(status())
    renderPage()

    await userEvent.click(
      await screen.findByRole("button", { name: "Mehmet Kaya yorumunu vitrinden kaldır" })
    )
    const dialog = await screen.findByRole("dialog")
    const reasons = within(dialog).getAllByRole("radio")
    const confirm = within(dialog).getByRole("button", { name: "Vitrinden kaldır" })

    expect(reasons).toHaveLength(3)
    expect(within(dialog).getByText("Kişisel veri içeriyor")).toBeInTheDocument()
    expect(within(dialog).getByText("Hakaret, küfür ya da nefret söylemi")).toBeInTheDocument()
    expect(within(dialog).getByText("Konu dışı ya da spam")).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        "Olumsuz yorumlar puanı nedeniyle kaldırılamaz; yalnızca bu üç gerekçeyle kaldırabilirsiniz."
      )
    ).toBeInTheDocument()
    expect(confirm).toBeDisabled()

    await userEvent.click(within(dialog).getByText("Hakaret, küfür ya da nefret söylemi"))
    await userEvent.click(confirm)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/google/reviews/items/grev_1", {
        method: "POST",
        body: { hidden: true, reason: "abusive" },
      })
    })
    expect(toastMock.success).toHaveBeenCalledWith("Yorum vitrinden kaldırıldı.")
  })

  it("puts a hidden review back on the storefront without a reason", async () => {
    answer(status())
    renderPage()

    await userEvent.click(await screen.findByRole("button", { name: "Vitrine geri al" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/google/reviews/items/grev_2", {
        method: "POST",
        body: { hidden: false },
      })
    })
    expect(toastMock.success).toHaveBeenCalledWith("Yorum vitrine geri alındı.")
  })

  it("asks to connect again when Google no longer takes the connection", async () => {
    answer(status({ error: "invalid_grant" }))
    renderPage()

    expect(
      await screen.findByText("Google bağlantısı yorumları okuyamıyor; yeniden bağlayın.")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Yeniden bağla" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Şimdi eşitle" })).not.toBeInTheDocument()
  })

  it("removes the Google reviews after asking, the Google account staying connected", async () => {
    answer(status(), { "/admin/google/reviews": status() })
    renderPage()

    await userEvent.click(await screen.findByRole("button", { name: "Bağlantıyı kaldır" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/Google hesabı bağlantısı/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaldır" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/google/reviews", { method: "DELETE" })
    })
  })
})
