import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { UrlStyles } from "@/features/settings/api/url-style"
import { UrlStyleCard } from "./url-style-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const SAVED: UrlStyles = { product: "prefixed", category: "prefixed", brand: "prefixed" }

const renderCard = (saved: UrlStyles = SAVED) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <UrlStyleCard saved={saved} />
    </QueryClientProvider>
  )

describe("UrlStyleCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
      if (url === "/admin/seo/url-style") {
        return Promise.resolve({ moves: 3, conflicts: [], skipped: [] })
      }
      if (url === "/admin/async-jobs" && init?.method === "POST") {
        return Promise.resolve({ async_job: { id: "job_1", status: "queued", progress: 0 } })
      }
      return Promise.resolve({ async_jobs: [], count: 0 })
    })
  })

  it("offers a category three styles, each with the address it gives (adr/0017 Ek 2026-11-23)", () => {
    renderCard()

    const prefixed = screen.getByRole("radio", { name: /Önekli, üst kategorilerle/ })
    const nested = screen.getByRole("radio", { name: /Öneksiz, üst kategorilerle/ })
    const flat = screen.getByRole("radio", { name: /Öneksiz, yalnız kendi adı/ })
    expect(prefixed).toBeChecked()
    expect(nested).not.toBeChecked()
    expect(flat).not.toBeChecked()
    expect(screen.getByText("/kategori/hediyelik-esyalar/caki-kutusu")).toBeInTheDocument()
    expect(screen.getByText("/hediyelik-esyalar/caki-kutusu")).toBeInTheDocument()
    expect(screen.getByText("/caki-kutusu")).toBeInTheDocument()
    // Products and brands keep their two
    expect(screen.getAllByRole("radio")).toHaveLength(7)
  })

  it("checks a move to the nested style, then starts the move job with it", async () => {
    renderCard()

    await userEvent.click(screen.getByRole("radio", { name: /Öneksiz, üst kategorilerle/ }))
    await userEvent.click(screen.getByRole("button", { name: "Değişikliği kontrol et" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/seo/url-style", {
        query: { product: "prefixed", category: "nested", brand: "prefixed" },
      })
    })
    expect(await screen.findByText(/3 sayfanın adresi değişecek/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Adresleri taşı" }))
    await userEvent.click(await screen.findByRole("button", { name: "Adresleri taşı" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/async-jobs", {
        method: "POST",
        body: {
          type: "seo.url_style",
          input: { product: "prefixed", category: "nested", brand: "prefixed" },
        },
      })
    })
  })

  it("shows the saved nested style as chosen", () => {
    renderCard({ ...SAVED, category: "nested" })

    expect(screen.getByRole("radio", { name: /Öneksiz, üst kategorilerle/ })).toBeChecked()
    expect(screen.queryByRole("button", { name: "Değişikliği kontrol et" })).toBeNull()
  })
})
