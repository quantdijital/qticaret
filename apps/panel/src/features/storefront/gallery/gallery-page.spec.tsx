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
  preset("grafit", { in_draft: 1, live: 1 }),
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

    const looks = await screen.findByRole("region", { name: "Kayıtlı görünümlerim (1/10)" })
    expect(within(looks).getAllByRole("article")).toHaveLength(2)
    expect(within(looks).getByRole("heading", { name: "Bayram vitrini" })).toBeInTheDocument()
    expect(
      within(looks).getByRole("heading", { name: "Grafit, 17 Kasım 14:20" })
    ).toBeInTheDocument()
    expect(within(looks).getByText("Otomatik")).toBeInTheDocument()
    expect(
      within(looks).getByText(
        "Otomatik kayıtların son 5 tanesi tutulur; adlı kayıt sınırına sayılmaz."
      )
    ).toBeInTheDocument()

    const presets = await screen.findByRole("heading", { name: "Tezgâh" })
    const ready = section("Hazır görünümler")
    expect(within(ready).getAllByRole("article")).toHaveLength(2)
    expect(presets.closest("article")).toContainElement(
      screen.getByRole("radiogroup", { name: "Renk takımı" })
    )

    expect(screen.getByRole("heading", { name: "Şu anki görünüm" })).toBeInTheDocument()
    expect(screen.getByText("Grafit · 1 Kas 2026 tarihinde yayınlandı")).toBeInTheDocument()
    expect(screen.getByText("Taslak yayındakiyle aynı")).toBeInTheDocument()
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
    expect(field.value).toMatch(/^Grafit, \d{1,2} \S+$/)

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
    expect(await screen.findByRole("heading", { name: "Grafit" })).toBeInTheDocument()
  })

  it("offers a retry when the ready-made looks cannot load", async () => {
    serve(gallery([]), new Error("down"))
    const user = userEvent.setup()
    renderPage()

    const retry = await screen.findByRole("button", { name: "Tekrar dene" })
    serve(gallery([]))
    await user.click(retry)
    expect(await screen.findByRole("heading", { name: "Grafit" })).toBeInTheDocument()
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
