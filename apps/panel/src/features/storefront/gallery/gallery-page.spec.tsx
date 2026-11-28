import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { layoutOf } from "@/features/storefront/editor/theme-editor.fixtures"
import type { DesignCard, DesignGallery, PresetCard } from "./api"
import { design, gallery, preset } from "./gallery.fixtures"
import { GalleryPage } from "./gallery-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/storefront/editor">{children}</a>,
  useNavigate: () => vi.fn(),
}))

const PRESETS = [
  preset("sade", { in_draft: 1, live: 1 }),
  preset("tezgah", { family: "tezgah", swatch: "Lacivert ve çelik", name: "Tezgâh" }),
  preset("tezgah-gece", { family: "tezgah", swatch: "Gece", name: "Tezgâh · Gece" }),
]

type Answer = DesignGallery | PresetCard[] | Error | "hold"

function serve(designs: Answer, presets: Answer = PRESETS) {
  const answer = (value: Answer, wrap: (value: never) => unknown) =>
    value === "hold"
      ? new Promise(() => undefined)
      : value instanceof Error
        ? Promise.reject(value)
        : Promise.resolve(wrap(value as never))
  fetchMock.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
    if (url === "/admin/storefront-designs" && init?.method === "POST") {
      return Promise.resolve({ design: design("sfd_new") })
    }
    if (url === "/admin/storefront-designs") {
      return answer(designs, (value) => value)
    }
    if (url === "/admin/storefront-presets") {
      return answer(presets, (value) => ({ presets: value }))
    }
    if (url === "/admin/storefront-layout") {
      return Promise.resolve({ layout: layoutOf() })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <GalleryPage />
    </QueryClientProvider>
  )
}

const section = (name: RegExp | string) => screen.getByRole("region", { name })
const saved = (count: number) =>
  Array.from({ length: count }, (_, at) =>
    design(`sfd_${at}`, {
      name: `Görünüm ${at + 1}`,
    })
  )

describe("GalleryPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("holds the cards' places while the looks load", () => {
    serve("hold", "hold")
    renderPage()

    expect(screen.getByRole("heading", { level: 1, name: "Görünümler" })).toBeInTheDocument()
    const loading = screen.getAllByText("Yükleniyor")
    expect(loading).toHaveLength(2)
    for (const each of loading) {
      expect(each.parentElement).toHaveAttribute("aria-busy", "true")
    }
  })

  it("shows where the design stands, the saved looks and one card per ready-made family", async () => {
    const auto = design("sfd_auto", {
      kind: "auto",
      name: null,
      created_at: "2026-11-17T11:20:00.000Z",
    })
    serve(gallery([design("sfd_1"), auto]))
    renderPage()

    const user = userEvent.setup()
    const looks = await screen.findByRole("region", { name: "Kayıtlı görünümlerim (1/10)" })
    // The named look a card; the automatic saves folded into a list, closed at first
    expect(within(looks).getAllByRole("article")).toHaveLength(1)
    expect(within(looks).getByRole("heading", { name: "Bayram vitrini" })).toBeInTheDocument()
    const fold = within(looks).getByRole("button", { name: "Otomatik kayıtlar (1)" })
    expect(fold).toHaveAttribute("aria-expanded", "false")
    expect(within(looks).getByText("En yenisi: 17 Kas 2026 14:20")).toBeVisible()
    expect(within(looks).queryByRole("listitem")).toBeNull()
    await user.click(fold)
    expect(within(looks).getByRole("listitem", { name: "Sade, 17 Kas 2026 14:20" })).toBeVisible()

    const presets = await screen.findByRole("heading", { name: "Tezgâh" })
    const ready = section("Hazır görünümler")
    expect(within(ready).getAllByRole("article")).toHaveLength(2)
    expect(presets.closest("article")).toContainElement(
      screen.getByRole("radiogroup", { name: "Renk takımı" })
    )
    // The ready-made looks come before the shop's own saves
    expect(ready.compareDocumentPosition(looks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const current = screen.getByRole("region", { name: "Şu anki görünüm" })
    // Where it stands, once: live since when
    expect(within(current).getByText("Yayında")).toBeInTheDocument()
    expect(within(current).getByText("1 Kas 2026 12:00 tarihinden beri")).toBeInTheDocument()
    expect(
      within(current).getByRole("button", { name: "Taslağı yeni sekmede önizle" })
    ).toBeEnabled()
  })

  it("says the draft waits to be published and what is live meanwhile", async () => {
    const full = gallery([])
    serve({
      ...full,
      current: { ...full.current, draft: { ...full.current.draft, has_changes: true } },
    })
    renderPage()

    const current = await screen.findByRole("region", { name: "Şu anki görünüm" })
    expect(within(current).getByText("Taslakta yayınlanmamış değişiklik var")).toBeInTheDocument()
    expect(within(current).getByText("Yayında: Sade · 1 Kas 2026 12:00")).toBeInTheDocument()
    expect(within(current).queryByText("Yayında")).toBeNull()
  })

  it("offers to save the current look when nothing is saved yet", async () => {
    serve(gallery([]))
    const user = userEvent.setup()
    renderPage()

    expect(
      await screen.findByText(
        "Henüz kayıtlı görünümünüz yok. Şu anki görünümü kaydederek istediğiniz zaman geri dönebilirsiniz."
      )
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Şu anki görünümü kaydet" }))
    const dialog = await screen.findByRole("dialog", { name: "Görünümü kaydet" })
    const field = within(dialog).getByRole<HTMLInputElement>("textbox", { name: "Ad" })
    expect(field.value).toMatch(/^Sade, \d{1,2} \S+ \d{4}$/)

    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/storefront-designs", {
        method: "POST",
        body: { name: field.value },
      })
    })
  })

  it("says once when the saved looks cannot load, and still shows the ready-made ones", async () => {
    serve(new Error("down"))
    renderPage()

    expect(await screen.findByText("Kayıtlı görünümler yüklenemedi.")).toBeInTheDocument()
    // No count it could not read
    expect(section("Kayıtlı görünümlerim")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Tekrar dene" })).toHaveLength(1)
    expect(await screen.findByRole("heading", { name: "Sade" })).toBeInTheDocument()
  })

  it("offers a retry when the ready-made looks cannot load", async () => {
    serve(gallery([]), new Error("down"))
    const user = userEvent.setup()
    renderPage()

    const retry = await screen.findByRole("button", { name: "Tekrar dene" })
    serve(gallery([]))
    await user.click(retry)
    expect(await screen.findByRole("heading", { name: "Sade" })).toBeInTheDocument()
  })

  it("closes saving when the named looks are full, and says so", async () => {
    serve(gallery(saved(10)))
    renderPage()

    expect(
      await screen.findByRole("region", { name: "Kayıtlı görünümlerim (10/10)" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Bu görünümü kaydet" })).toBeDisabled()
    expect(screen.getByText("Adlı kayıtlar dolu; yenisi için birini silin.")).toBeInTheDocument()
  })

  it("folds the other sectors' looks under their names, below the shop's own (owner, 2026-11-28)", async () => {
    const cutlery = { code: "cutlery", name: "Bıçak ve çatal-bıçak" }
    serve(gallery([]), [
      ...PRESETS,
      preset("katalog", { pack: "cutlery", name: "Katalog", own: false, sector: cutlery }),
    ])
    const user = userEvent.setup()
    renderPage()

    const toggle = await screen.findByRole("button", { name: "Diğer sektörler" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByText("Bıçak ve çatal-bıçak · 1 görünüm")).toBeVisible()
    expect(screen.queryByRole("heading", { name: "Katalog" })).toBeNull()
    // The shop's own looks carry their sector's tag too
    expect(within(section("Hazır görünümler")).getAllByText("Genel")[0]).toBeVisible()

    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    const run = screen.getByRole("region", { name: "Bıçak ve çatal-bıçak" })
    expect(within(run).getByRole("heading", { name: "Katalog" })).toBeVisible()
    expect(within(run).getByTitle("Bıçak ve çatal-bıçak için hazırlandı")).toBeVisible()
  })

  it("asks before a look goes into the draft, with the draft's unpublished changes named", async () => {
    const draft: DesignCard = design("sfd_1")
    const full = gallery([draft])
    serve({
      ...full,
      current: { ...full.current, draft: { ...full.current.draft, has_changes: true } },
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole("button", { name: "‘Bayram vitrini’ görünümünü taslağa al" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "‘Bayram vitrini’ taslağa uygulansın mı?",
    })
    expect(
      within(dialog).getByText(/Taslaktaki yayınlanmamış değişiklikler bu görünümle/)
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText("Menülerinize dokunulmaz; kayıtlı görünümler menü taşımaz.")
    ).toBeInTheDocument()
  })
})
