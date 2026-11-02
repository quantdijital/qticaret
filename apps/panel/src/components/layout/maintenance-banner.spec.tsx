import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { MaintenanceSettings } from "@/features/storefront/api/maintenance"
import { MaintenanceBanner } from "./maintenance-banner"

const fetchMock = vi.hoisted(() => vi.fn<(url: string) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
    className,
  }: {
    to: string
    search: { part: string }
    children: ReactNode
    className?: string
  }) => (
    <a href={`${to}?part=${search.part}`} className={className}>
      {children}
    </a>
  ),
}))

const URL = "/admin/platform-settings/maintenance"
const section = (enabled: boolean) => ({
  section: "maintenance",
  values: {
    enabled,
    title: null,
    message: null,
    expected_at: null,
    allow_paths: [],
  } satisfies MaintenanceSettings,
  version: 1,
})

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MaintenanceBanner />
    </QueryClientProvider>
  )
  return client
}

describe("MaintenanceBanner", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("says the storefront is dark on every page, linking to its tab", async () => {
    fetchMock.mockResolvedValue(section(true))
    renderBanner()

    const banner = await screen.findByRole("status")
    expect(banner).toHaveTextContent(
      "Vitrin bakım modunda: alıcılar mağaza yerine bakım sayfasını görüyor."
    )
    expect(screen.getByRole("link", { name: "Bakım modu ayarları" })).toHaveAttribute(
      "href",
      "/storefront/preferences?part=maintenance"
    )
    expect(fetchMock).toHaveBeenCalledWith(URL)
  })

  it("shows nothing while the storefront is open, and appears once a save turns it on", async () => {
    fetchMock.mockResolvedValue(section(false))
    const client = renderBanner()
    await vi.waitFor(() => {
      expect(client.getQueryState(["settings", "maintenance"])?.status).toBe("success")
    })
    expect(screen.queryByRole("status")).toBeNull()

    // A save puts the stored section in the cache (useSaveSection): no new request
    act(() => {
      client.setQueryData(["settings", "maintenance"], section(true))
    })
    expect(await screen.findByRole("status")).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
