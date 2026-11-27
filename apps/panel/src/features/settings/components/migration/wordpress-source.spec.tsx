import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { MAX_WXR_BYTES } from "@/features/settings/api/migration-wordpress"
import { RunCard } from "@/features/settings/components/migration/run-card"
import { WordpressSource } from "@/features/settings/components/migration/wordpress-source"

const sdkFetch = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const answers: Record<string, unknown> = {
  "/admin/migrations": { runs: [] },
  "/admin/integrations/credentials": { key_configured: true, accounts: [] },
  "/admin/async-jobs/job_wp": { async_job: { id: "job_wp", status: "running", progress: 10 } },
}

/** An export of the given name, its size as the browser would report it. */
const exportFile = (name: string, size?: number, type = "text/xml") => {
  const file = new File(['<rss xmlns:wp="http://wordpress.org/export/1.2/"></rss>'], name, { type })
  if (size !== undefined) {
    Object.defineProperty(file, "size", { value: size })
  }
  return file
}

// The upload goes past the SDK, as its bytes: the browser's own fetch
const uploads = vi.fn()

const PARCEL = [
  ["Ağırlık (g)", "500"],
  ["Uzunluk (cm)", "30"],
  ["Genişlik (cm)", "20"],
  ["Yükseklik (cm)", "10"],
] as const

async function chooseWordpress() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RunCard />
    </QueryClientProvider>
  )
  await userEvent.click(await screen.findByRole("combobox", { name: "Kaynak" }))
  await userEvent.click(await screen.findByRole("option", { name: "WordPress / WooCommerce" }))
}

describe("Settings > Migration: the WordPress source", () => {
  beforeEach(() => {
    sdkFetch.mockReset()
    sdkFetch.mockImplementation((url: string) => Promise.resolve(answers[url] ?? {}))
    uploads.mockReset()
    uploads.mockResolvedValue(
      new Response(JSON.stringify({ async_job: { id: "job_wp", status: "queued", progress: 0 } }), {
        status: 202,
        headers: { "content-type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", uploads)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("says at once when the file is no export or larger than 50 MB, and runs nothing", async () => {
    const onRun = vi.fn()
    // The input's accept is a hint to the file dialog only: a person may still pick any file
    const user = userEvent.setup({ applyAccept: false })
    render(<WordpressSource disabled={false} pending={null} onRun={onRun} />)
    const input = screen.getByLabelText("Dışa aktarma dosyası")
    const check = screen.getByRole("button", { name: "Kuru çalıştır" })
    expect(check).toBeDisabled()

    await user.upload(input, exportFile("katalog.pdf", undefined, "application/pdf"))
    expect(await screen.findByText(/Bu dosya bir WordPress dışa aktarması değil/)).toBeVisible()

    await user.upload(input, exportFile("site.WordPress.2026-11-02.xml", MAX_WXR_BYTES + 1))
    expect(await screen.findByText(/Dosya 50 MB'tan büyük/)).toBeVisible()
    await user.click(check)
    expect(onRun).not.toHaveBeenCalled()

    // Exactly the cap is taken, as the server takes it
    await user.upload(input, exportFile("site.WordPress.2026-11-02.zip", MAX_WXR_BYTES))
    await waitFor(() => {
      expect(screen.queryByText(/Dosya 50 MB'tan büyük/)).toBeNull()
    })
  })

  it("asks for an address base of one segment and a parcel of all four values", async () => {
    const onRun = vi.fn()
    render(<WordpressSource disabled={false} pending={null} onRun={onRun} />)
    await userEvent.upload(screen.getByLabelText("Dışa aktarma dosyası"), exportFile("site.xml"))
    await userEvent.type(screen.getByLabelText("Kategori adres öneki"), "/urun/kategori/alt")
    await userEvent.type(screen.getByLabelText("Ağırlık (g)"), "500")
    await userEvent.click(screen.getByRole("button", { name: "Kuru çalıştır" }))

    expect(await screen.findByText(/Tek bölümlük bir yol girin/)).toBeVisible()
    expect(screen.getByText(/dört değerini de sıfırdan büyük girin/)).toBeVisible()
    expect(onRun).not.toHaveBeenCalled()
    // Products without measurements still come as the source has them (adr/0054): the form says so
    expect(screen.getByText(/kaynaktaki durumlarıyla gelir/)).toBeVisible()
  })

  it("checks the export with source=wordpress, its address base and parcel, typed as XML", async () => {
    await chooseWordpress()
    expect(screen.getByText(/Araçlar > Dışa aktar > Tüm içerik/)).toBeVisible()
    const file = exportFile("site.WordPress.2026-11-02.xml")
    await userEvent.upload(screen.getByLabelText("Dışa aktarma dosyası"), file)
    await userEvent.type(screen.getByLabelText("Kategori adres öneki"), "/urun-kategori/")
    for (const [label, value] of PARCEL) {
      await userEvent.type(screen.getByLabelText(label), value)
    }
    await userEvent.click(screen.getByRole("button", { name: "Kuru çalıştır" }))

    await waitFor(() => {
      expect(uploads).toHaveBeenCalledTimes(1)
    })
    const [path, init] = uploads.mock.calls[0] as [string, RequestInit]
    expect(path).toBe(
      "/admin/migrations?source=wordpress&mode=check&category_base=%2Furun-kategori%2F&weight=500&length=30&width=20&height=10"
    )
    expect(init).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/xml" },
    })
    expect(init.body).toBe(file)
    expect(await screen.findByText(/Çalışıyor… %10/)).toBeInTheDocument()
  })

  it("applies a zip once confirmed, typed as the server takes it whatever the browser calls it", async () => {
    await chooseWordpress()
    // Windows names a zip so; the server's CSRF rule takes application/zip
    const file = exportFile("site.zip", undefined, "application/x-zip-compressed")
    await userEvent.upload(screen.getByLabelText("Dışa aktarma dosyası"), file)
    await userEvent.click(screen.getByRole("button", { name: "Uygula" }))
    expect(uploads).not.toHaveBeenCalled()
    const confirm = await screen.findByRole("alertdialog")
    await userEvent.click(within(confirm).getByRole("button", { name: "Uygula" }))

    await waitFor(() => {
      expect(uploads).toHaveBeenCalledTimes(1)
    })
    const [path, init] = uploads.mock.calls[0] as [string, RequestInit]
    // Neither base nor parcel given: the server reads the base from the site's links
    expect(path).toBe("/admin/migrations?source=wordpress&mode=apply")
    expect(init.headers).toEqual({ "content-type": "application/zip" })
    expect(init.body).toBe(file)
  })

  // ADR-0055: the descriptions of products moved before, rewritten and nothing else
  it("refreshes only the descriptions: applied alone, without the base or the parcel", async () => {
    await chooseWordpress()
    const file = exportFile("site.xml")
    await userEvent.upload(screen.getByLabelText("Dışa aktarma dosyası"), file)
    // Typed before the box is ticked: a refresh neither reads nor checks them
    await userEvent.type(screen.getByLabelText("Kategori adres öneki"), "/urun/kategori/alt")
    await userEvent.type(screen.getByLabelText("Ağırlık (g)"), "500")
    const refresh = screen.getByRole("checkbox", { name: "Yalnız açıklamaları yenile" })
    await userEvent.click(refresh)

    expect(refresh).toBeChecked()
    expect(screen.getByRole("button", { name: "Kuru çalıştır" })).toBeDisabled()
    expect(screen.getByLabelText("Kategori adres öneki")).toBeDisabled()
    expect(screen.getByLabelText("Ağırlık (g)")).toBeDisabled()
    expect(screen.getByText(/Fiyat, stok, durum ve SEO alanlarına dokunulmaz/)).toBeVisible()

    await userEvent.click(screen.getByRole("button", { name: "Uygula" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(within(confirm).getByText("Açıklamalar yenilensin mi?")).toBeVisible()
    await userEvent.click(within(confirm).getByRole("button", { name: "Uygula" }))

    await waitFor(() => {
      expect(uploads).toHaveBeenCalledTimes(1)
    })
    const [path, init] = uploads.mock.calls[0] as [string, RequestInit]
    expect(path).toBe("/admin/migrations?source=wordpress&mode=apply&refresh=descriptions")
    expect(init.body).toBe(file)
    expect(screen.queryByText(/Tek bölümlük bir yol girin/)).toBeNull()
  })

  it("runs in full again once the box is cleared, the dry run back", async () => {
    const onRun = vi.fn()
    render(<WordpressSource disabled={false} pending={null} onRun={onRun} />)
    await userEvent.upload(screen.getByLabelText("Dışa aktarma dosyası"), exportFile("site.xml"))
    const refresh = screen.getByRole("checkbox", { name: "Yalnız açıklamaları yenile" })
    await userEvent.click(refresh)
    await userEvent.click(refresh)
    await userEvent.click(screen.getByRole("button", { name: "Kuru çalıştır" }))

    await waitFor(() => {
      expect(onRun).toHaveBeenCalledWith(
        "check",
        expect.objectContaining({ refresh: null, categoryBase: "", parcel: null })
      )
    })
  })

  // adr/0042 Ek 2026-11-27: the blog posts' pictures an earlier run left out, tried dry first
  it("moves only the blog pictures, one refresh at a time, the dry run kept", async () => {
    const onRun = vi.fn()
    render(<WordpressSource disabled={false} pending={null} onRun={onRun} />)
    await userEvent.upload(screen.getByLabelText("Dışa aktarma dosyası"), exportFile("site.xml"))
    const descriptions = screen.getByRole("checkbox", { name: "Yalnız açıklamaları yenile" })
    const pictures = screen.getByRole("checkbox", { name: "Yalnız blog görsellerini taşı" })
    await userEvent.click(descriptions)
    await userEvent.click(pictures)

    expect(pictures).toBeChecked()
    expect(descriptions).not.toBeChecked()
    expect(screen.getByLabelText("Kategori adres öneki")).toBeDisabled()
    await userEvent.click(screen.getByRole("button", { name: "Kuru çalıştır" }))

    await waitFor(() => {
      expect(onRun).toHaveBeenCalledWith(
        "check",
        expect.objectContaining({ refresh: "post_images", categoryBase: "", parcel: null })
      )
    })
  })
})
