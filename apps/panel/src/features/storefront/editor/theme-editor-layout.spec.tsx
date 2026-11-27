import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { opened, renderEditor, serve } from "./theme-editor.fixtures"
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

/** The window as `width` px wide, as far as media queries go (jsdom has none). */
function windowOf(width: number) {
  window.matchMedia = (query: string) =>
    ({
      matches: width >= Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
}

const frame = () => screen.findByTitle("Vitrin önizlemesi")
const settings = () => screen.getByRole("region", { name: "Giriş" })

describe("the theme editor's layout", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    serve(fetchMock, admin)
  })
  afterEach(() => {
    // jsdom's own window has no media queries
    Reflect.deleteProperty(window, "matchMedia")
  })

  it.each([1440, 1100])(
    "swaps one side panel's content between the parts and a part's settings at %i px",
    async (width) => {
      windowOf(width)
      renderEditor()
      const tree = await opened()
      await frame()
      // Nothing open: the list alone
      expect(screen.queryByRole("region")).toBeNull()

      await userEvent.click(within(tree).getByRole("button", { name: "Giriş" }))
      expect(settings()).toBeVisible()
      // The list makes room: one side panel, not one beside another, and no drawer
      expect(tree).not.toBeVisible()
      expect(screen.queryByRole("button", { name: "Bölümler" })).toBeNull()
      expect(screen.queryByRole("radio", { name: "Önizle" })).toBeNull()
      // The way back names where it leads, the breadcrumb where the panel stands
      const trail = screen.getByRole("navigation", { name: "Konum" })
      expect(trail).toHaveTextContent("Ana sayfaGiriş")

      await userEvent.click(screen.getByRole("button", { name: "Bölümlere dön" }))
      expect(screen.queryByRole("region")).toBeNull()
      expect(tree).toBeVisible()
      // The section just left stays marked
      expect(within(tree).getByRole("button", { name: "Giriş" })).toHaveAttribute(
        "aria-current",
        "true"
      )
    }
  )

  it("goes back by the breadcrumb or one step with Escape, keeping the list's search", async () => {
    windowOf(1100)
    renderEditor()
    await opened()
    const search = screen.getByRole("searchbox", { name: "Ayarlarda ara" })
    await userEvent.type(search, "blog limit")
    const hit = () =>
      within(screen.getByRole("list", { name: "Arama sonuçları" })).getByRole("button", {
        name: /Gösterilecek sayı/,
      })
    await userEvent.click(hit())
    expect(search).not.toBeVisible()

    // The breadcrumb's first step is the page's parts, the search as it was left
    const trail = screen.getByRole("navigation", { name: "Konum" })
    await userEvent.click(within(trail).getByRole("button", { name: "Ana sayfa" }))
    expect(search).toBeVisible()
    expect(search).toHaveValue("blog limit")

    // Escape takes the panel up a step; at the list it leaves the search be
    await userEvent.click(hit())
    expect(screen.getByRole("region", { name: "Blog yazıları" })).toBeVisible()
    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("region")).toBeNull()
    expect(search).toBeVisible()
    expect(search).toHaveValue("blog limit")
  })

  it("switches between the settings and the preview on a phone, keeping both", async () => {
    windowOf(390)
    renderEditor()
    const tree = await opened()
    const preview = await frame()
    // A phone's preview starts as a phone, and only the settings show at first
    expect(preview).toHaveAttribute("data-device", "mobile")
    expect(screen.getByRole("radio", { name: "Düzenle" })).toHaveAttribute("data-state", "on")
    expect(preview).not.toBeVisible()

    await userEvent.click(within(tree).getByRole("button", { name: "Giriş" }))
    const panel = settings()
    await userEvent.click(screen.getByRole("radio", { name: "Önizle" }))
    expect(preview).toBeVisible()
    expect(panel).not.toBeVisible()

    // The settings come back as they were left
    await userEvent.click(screen.getByRole("radio", { name: "Düzenle" }))
    expect(panel).toBeVisible()
    expect(settings()).toBe(panel)
    expect(preview).not.toBeVisible()
  })

  it("draws the preview at the chosen device's width", async () => {
    renderEditor()
    await opened()
    const preview = await frame()
    expect(preview).toHaveAttribute("data-device", "desktop")
    expect(preview).toHaveStyle({ width: "1280px" })

    await userEvent.click(screen.getByRole("radio", { name: "Tablet" }))
    expect(preview).toHaveAttribute("data-device", "tablet")
    expect(preview).toHaveStyle({ width: "768px" })
    await userEvent.click(screen.getByRole("radio", { name: "Telefon" }))
    expect(preview).toHaveStyle({ width: "390px" })
  })
})
