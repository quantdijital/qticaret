import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { MigrationOverview } from "@/features/settings/api/migration-overview"
import { CompletionsCard } from "@/features/settings/components/migration/completions-card"
import { OverviewTiles } from "@/features/settings/components/migration/overview-tiles"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/reauth", () => ({
  withReauth: (call: (extra: object) => Promise<unknown>) => call({}),
  isReauthCancelled: () => false,
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const overview: MigrationOverview = {
  last_run: {
    id: "mrun_1",
    source: "wordpress",
    status: "done",
    job_id: "ajob_1",
    created_at: "2026-11-26T11:00:00.000Z",
    finished_at: "2026-11-26T11:10:00.000Z",
  },
  sources: ["wordpress:eski-magaza.com"],
  kinds: {
    product: { moved: 221, problems: 2 },
    image: { moved: 980, problems: 22 },
    category: { moved: 49, problems: 0 },
    post: { moved: 37, problems: 0 },
  },
  missing: {
    images: 14,
    post_images: 12,
    summaries: 0,
    category_covers: 3,
    urls: 8,
    descriptions: 221,
  },
  addresses: { total: 412, undecided: 9 },
}

const render_ = (element: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>)

describe("Settings > Migration: what moved and its completions", () => {
  const upload = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    upload.mockReset()
    upload.mockResolvedValue({
      ok: true,
      status: 202,
      json: () => Promise.resolve({ async_job: { id: "ajob_2", status: "queued", progress: 0 } }),
    })
    vi.stubGlobal("fetch", upload)
    fetchMock.mockResolvedValue({ async_job: { id: "ajob_2", status: "running", progress: 40 } })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows each kind with what is missing, customers as not moved", () => {
    render_(<OverviewTiles overview={overview} />)
    const images = screen.getByTestId("migration-tile-image")
    expect(within(images).getByText("980")).toBeInTheDocument()
    expect(within(images).getByText("22 görsel eksik")).toBeInTheDocument()
    expect(
      within(screen.getByTestId("migration-tile-post")).getByText("12 yazının görseli eksik")
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId("migration-tile-customer")).getByText("Taşınmadı")
    ).toBeInTheDocument()
    expect(screen.getByText(/Daha önce taşınan kayıtlara dokunulmaz/)).toBeInTheDocument()
  })

  it("lists the completions with their counts and starts one through its dialog", async () => {
    render_(<CompletionsCard overview={overview} />)
    const images = screen.getByTestId("completion-images")
    expect(within(images).getByText("14 üründe eksik")).toBeInTheDocument()
    // Nothing missing says so; the button stays
    const summaries = screen.getByTestId("completion-summaries")
    expect(within(summaries).getByText("Eksik yok")).toBeInTheDocument()
    expect(within(summaries).getByRole("button", { name: "Başlat" })).toBeEnabled()

    await userEvent.click(within(images).getByRole("button", { name: "Başlat" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Değişecek:")).toBeInTheDocument()
    expect(within(dialog).getByText("Değişmeyecek:")).toBeInTheDocument()
    const submit = within(dialog).getByRole("button", { name: "Görselleri indir" })
    expect(submit).toBeDisabled()
    await userEvent.upload(
      within(dialog).getByLabelText("Dışa aktarma dosyası"),
      new File(["<rss/>"], "site.xml", { type: "text/xml" })
    )
    await userEvent.click(submit)
    await waitFor(() => {
      expect(upload).toHaveBeenCalledWith(
        "/admin/migrations?source=wordpress&mode=apply&refresh=images",
        expect.objectContaining({ method: "POST" })
      )
    })
    expect(await within(images).findByText("Çalışıyor · %40")).toBeInTheDocument()
  })

  it("rebuilds the 301s without a file", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === "/admin/migrations/urls/rebuild"
          ? { async_job: { id: "ajob_3", status: "queued", progress: 0 } }
          : { async_job: { id: "ajob_3", status: "running", progress: 10 } }
      )
    )
    render_(<CompletionsCard overview={overview} />)
    const urls = screen.getByTestId("completion-urls")
    expect(within(urls).getByText("8 eksik")).toBeInTheDocument()
    await userEvent.click(within(urls).getByRole("button", { name: "Başlat" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).queryByLabelText("Dışa aktarma dosyası")).toBeNull()
    await userEvent.click(within(dialog).getByRole("button", { name: "Yönlendirmeleri oluştur" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/migrations/urls/rebuild", {
        method: "POST",
        body: {},
      })
    })
  })
})
