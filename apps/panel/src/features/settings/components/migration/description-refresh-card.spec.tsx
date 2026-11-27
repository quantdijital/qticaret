import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { DescriptionRefreshCard } from "@/features/settings/components/migration/description-refresh-card"
import { RunCard } from "@/features/settings/components/migration/run-card"

const sdkFetch = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const answers: Record<string, unknown> = {
  "/admin/migrations": { runs: [] },
  "/admin/integrations/credentials": { key_configured: true, accounts: [] },
  "/admin/async-jobs/job_refresh": {
    async_job: { id: "job_refresh", status: "running", progress: 30 },
  },
}

// The upload goes past the SDK, as its bytes: the browser's own fetch
const uploads = vi.fn()

const exportFile = (name: string, type = "text/xml") =>
  new File(['<rss xmlns:wp="http://wordpress.org/export/1.2/"></rss>'], name, { type })

const renderCard = (element: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>)

describe("Settings > Migration: taking the product descriptions again (ADR-0055)", () => {
  beforeEach(() => {
    sdkFetch.mockReset()
    sdkFetch.mockImplementation((url: string) => Promise.resolve(answers[url] ?? {}))
    uploads.mockReset()
    uploads.mockResolvedValue(
      new Response(
        JSON.stringify({ async_job: { id: "job_refresh", status: "queued", progress: 0 } }),
        { status: 202, headers: { "content-type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", uploads)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("says it overwrites panel edits, asks for the export again and starts only the refresh", async () => {
    renderCard(<DescriptionRefreshCard />)
    expect(screen.getByText(/panelde yaptığınız açıklama değişiklikleri gider/)).toBeVisible()

    await userEvent.click(screen.getByRole("button", { name: "Başlat" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Değişecek:")).toBeVisible()
    expect(within(dialog).getByText("Değişmeyecek:")).toBeVisible()
    expect(within(dialog).getByText(/her aktarım bittiğinde dosya silinir/)).toBeVisible()
    const submit = within(dialog).getByRole("button", { name: "Açıklamaları değiştir" })
    // Nothing starts without the export
    expect(submit).toBeDisabled()

    const file = exportFile("site.WordPress.xml")
    await userEvent.upload(within(dialog).getByLabelText("Dışa aktarma dosyası"), file)
    await userEvent.click(submit)

    await waitFor(() => {
      expect(uploads).toHaveBeenCalledTimes(1)
    })
    const [path, init] = uploads.mock.calls[0] as [string, RequestInit]
    expect(path).toBe("/admin/migrations?source=wordpress&mode=apply&refresh=descriptions")
    expect(init.body).toBe(file)
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    expect(await screen.findByText(/Aktarılıyor… %30/)).toBeInTheDocument()
  })

  it("refuses a file that is no WordPress export", async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderCard(<DescriptionRefreshCard />)
    await user.click(screen.getByRole("button", { name: "Başlat" }))
    const dialog = await screen.findByRole("dialog")
    await user.upload(
      within(dialog).getByLabelText("Dışa aktarma dosyası"),
      exportFile("katalog.pdf", "application/pdf")
    )
    expect(
      await within(dialog).findByText(/Bu dosya bir WordPress dışa aktarması değil/)
    ).toBeVisible()
    expect(within(dialog).getByRole("button", { name: "Açıklamaları değiştir" })).toBeDisabled()
    expect(uploads).not.toHaveBeenCalled()
  })
})

describe("Settings > Migration: the sources", () => {
  beforeEach(() => {
    sdkFetch.mockReset()
    sdkFetch.mockImplementation((url: string) => Promise.resolve(answers[url] ?? {}))
  })

  it("offers the team's bundle only from its own link", async () => {
    const { unmount } = renderCard(<RunCard />)
    await userEvent.click(await screen.findByRole("combobox", { name: "Kaynak" }))
    expect(await screen.findByRole("option", { name: "WordPress / WooCommerce" })).toBeVisible()
    expect(screen.queryByRole("option", { name: /geçiş dosyası/ })).toBeNull()
    unmount()

    renderCard(<RunCard withBundle />)
    expect(await screen.findByRole("combobox", { name: "Kaynak" })).toHaveTextContent(
      "Ekibimizin hazırladığı geçiş dosyası"
    )
  })
})
