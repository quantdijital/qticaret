import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { FeatureState } from "@/features/settings/api/features"
import { FeaturesPage } from "./features-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

const FLAGS: FeatureState[] = [
  { key: "catalog.collections", default: true, owner: "tenant", enabled: true },
  { key: "catalog.non_physical", default: false, owner: "tenant", enabled: false },
]

function serve(live: number) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    if (url === "/admin/collection-board") {
      return Promise.resolve({ collections: [], count: live, live_count: live })
    }
    return Promise.resolve(init?.method === "POST" ? { feature: FLAGS[0] } : { features: FLAGS })
  })
}

const posts = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <FeaturesPage />
    </QueryClientProvider>
  )
}

describe("FeaturesPage: turning collections off", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("warns with the live pages' count, and turns them off only once confirmed", async () => {
    serve(3)
    renderPage()
    fireEvent.click(await screen.findByRole("switch", { name: "Koleksiyonlar" }))

    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("Koleksiyonlar kapatılsın mı?")
    expect(
      await screen.findByText(
        "3 koleksiyon sayfası yayında. Adresleri 404 olur; arama motorlarındaki sıralamalarını kaybedebilir."
      )
    ).toBeInTheDocument()
    expect(posts()).toHaveLength(0)

    fireEvent.click(screen.getByRole("button", { name: "Koleksiyonları kapat" }))
    await waitFor(() => {
      expect(posts()).toHaveLength(1)
    })
    expect(posts()[0]).toEqual([
      "/admin/features/catalog.collections",
      { method: "POST", body: { enabled: false } },
    ])
  })

  it("asks without the warning when no collection page is live, and cancelling keeps them on", async () => {
    serve(0)
    renderPage()
    fireEvent.click(await screen.findByRole("switch", { name: "Koleksiyonlar" }))

    await screen.findByRole("alertdialog")
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/collection-board", expect.anything())
    })
    expect(screen.queryByText(/koleksiyon sayfası yayında/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }))

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull()
    })
    expect(posts()).toHaveLength(0)
  })

  it("turns another flag on or off without asking", async () => {
    serve(3)
    renderPage()
    fireEvent.click(await screen.findByRole("switch", { name: "Dijital ve hizmet ürünleri" }))

    await waitFor(() => {
      expect(posts()).toHaveLength(1)
    })
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })
})
