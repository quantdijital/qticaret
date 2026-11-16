import { screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import {
  holdClock,
  lastSaved,
  opened,
  pass,
  releaseClock,
  renderEditor,
  serve,
} from "./theme-editor.fixtures"
import type { AdminMock, Init } from "./theme-editor.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const admin = vi.hoisted<AdminMock>(() => ({
  productCategory: { list: vi.fn() },
  product: { list: vi.fn() },
  productCollection: { list: vi.fn() },
}))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock }, admin } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useRouter: () => ({ history: { back: vi.fn() } }),
  useCanGoBack: () => true,
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: "idle" }),
}))

let user: UserEvent

const searchbox = () => screen.getByRole("searchbox", { name: "Ayarlarda ara" })

/** adr/0049 Ek 2026-11-14 §6: the settings search above the page's parts. */
describe("the theme editor's settings search", () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    serve(fetchMock, admin)
  })
  afterEach(() => {
    releaseClock()
  })

  it("finds a look field by its technical term on every section of the page", async () => {
    renderEditor()
    await opened()

    await user.type(searchbox(), "margin-top")

    const hits = within(screen.getByRole("list", { name: "Arama sonuçları" }))
    expect(hits.getAllByRole("button").map((hit) => hit.textContent)).toEqual([
      "Üst boşluk margin-top" + "Giriş · Gelişmiş › Boşluk",
      "Üst boşluk margin-top" + "Ürün listesi · Gelişmiş › Boşluk",
      "Üst boşluk margin-top" + "Blog yazıları · Gelişmiş › Boşluk",
    ])
    // The list of the page's parts gives way while something is typed
    expect(screen.queryByRole("navigation", { name: "Sayfanın bölümleri" })).toBeNull()
  })

  it("finds a content field by its term and lands on it, focused and marked (denetim O2)", async () => {
    renderEditor()
    await opened()

    await user.type(searchbox(), "blog limit")
    const hits = within(screen.getByRole("list", { name: "Arama sonuçları" }))
    const hit = hits.getByRole("button", { name: /Gösterilecek sayı/ })
    expect(hit).toHaveTextContent("Gösterilecek sayı limit" + "Blog yazıları · İçerik")
    await user.click(hit)

    const field = document.getElementById("blogyazilari-content-limit")
    expect(field).toHaveAttribute("data-highlight")
    expect(screen.getByRole("spinbutton", { name: "Gösterilecek sayı" })).toHaveFocus()
  })

  it("finds the theme's settings and opens the theme panel at the picked one (Ek 2026-11-15)", async () => {
    renderEditor()
    await opened()

    await user.type(searchbox(), "border-radius")
    const hits = within(screen.getByRole("list", { name: "Arama sonuçları" }))
    const hit = hits.getByRole("button", { name: /Köşeler border-radius/ })
    expect(hit).toHaveTextContent("Köşeler border-radius" + "Tema ayarları · Şekiller")
    await user.click(hit)

    expect(screen.getByRole("heading", { name: "Tema ayarları" })).toBeInTheDocument()
    const field = document.getElementById("theme-radius")
    expect(field).toHaveAttribute("data-highlight")
    expect(field).toHaveFocus()
  })

  it("finds a theme choice by its name: the section spacing's 'Ferah'", async () => {
    renderEditor()
    await opened()

    await user.type(searchbox(), "ferah")
    const hits = within(screen.getByRole("list", { name: "Arama sonuçları" }))
    await user.click(hits.getByRole("button", { name: /Bölüm aralığı section spacing: Ferah/ }))

    expect(document.getElementById("theme-section-spacing")).toHaveAttribute("data-highlight")
  })

  it("brings the list back on Escape, and says when nothing is found", async () => {
    renderEditor()
    await opened()

    await user.type(searchbox(), "olmayan ayar")
    expect(screen.getByText("“olmayan ayar” için ayar bulunamadı.")).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(searchbox()).toHaveValue("")
    expect(screen.getByRole("navigation", { name: "Sayfanın bölümleri" })).toBeInTheDocument()
  })

  it("opens the section at the picked field, its closed group open, and saves a step", async () => {
    renderEditor()
    await opened()

    await user.type(searchbox(), "ürün listesi zemin")
    await user.click(screen.getByRole("button", { name: /Zemin background/ }))

    // Its tab picked, its closed group opened
    expect(screen.getByRole("tab", { name: /^Stil/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("button", { name: "Görünüm" })).toHaveAttribute("aria-expanded", "true")
    const ground = screen.getByRole("radiogroup", { name: "Zemin background" })
    expect(ground.closest("[data-highlight]")).not.toBeNull()

    await user.click(within(ground).getByRole("radio", { name: "Koyu" }))
    expect(screen.getByRole("button", { name: /^Görünüm, 1 ayar/ })).toBeInTheDocument()
    await pass(AUTOSAVE_MS)

    await waitFor(() => {
      expect(lastSaved(fetchMock)?.home[1]).toMatchObject({
        id: "yeniurunler",
        look: { ground: "stage", space_outer: null },
      })
    })
  })
})
