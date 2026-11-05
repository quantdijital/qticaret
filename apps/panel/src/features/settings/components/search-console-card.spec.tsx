import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SearchConsoleCard } from "./search-console-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: unknown }) => children,
}))

const google = (search_console: { granted: boolean; site: string | null }) => ({
  google: {
    configured: true,
    connected: true,
    email: "magaza@example.com",
    merchant_id: null,
    search_console,
    last_sync: null,
  },
})

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SearchConsoleCard />
    </QueryClientProvider>
  )
}

describe("SearchConsoleCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("is not there while the platform has not opened Google, nor its way to Marketing", async () => {
    fetchMock.mockResolvedValue({
      google: {
        ...google({ granted: false, site: null }).google,
        configured: false,
        connected: false,
      },
    })
    const { container } = renderCard()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/google")
    })
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement()
    })
  })

  it("asks to connect again when the account was connected without Search Console", async () => {
    fetchMock.mockResolvedValue(google({ granted: false, site: null }))
    renderCard()

    expect(await screen.findByRole("button", { name: "Yeniden bağla" })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/google/search-console/sites")
  })

  it("offers the properties the account reads, the saved one chosen", async () => {
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/admin/google/search-console/sites"
          ? { sites: [{ site_url: "sc-domain:magaza.example.com", permission: "siteOwner" }] }
          : google({ granted: true, site: "sc-domain:magaza.example.com" })
      )
    )
    renderCard()

    expect((await screen.findAllByText("sc-domain:magaza.example.com")).length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeDisabled()
  })
})
