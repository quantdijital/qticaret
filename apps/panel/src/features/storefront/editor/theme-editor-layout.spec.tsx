import { screen, waitFor, within } from "@testing-library/react"
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

  it("shows the parts, the open part's settings and the preview side by side on a wide screen", async () => {
    windowOf(1440)
    renderEditor()
    const tree = await opened()
    await frame()
    // Nothing open: the preview takes the settings' room
    expect(screen.queryByRole("region")).toBeNull()

    await userEvent.click(within(tree).getByRole("button", { name: "Giriş" }))
    expect(settings()).toBeVisible()
    expect(tree).toBeVisible()
    expect(within(tree).getByRole("button", { name: "Giriş" })).toHaveAttribute(
      "aria-current",
      "true"
    )
    // The list is beside it: no drawer, a way back instead, no edit-or-preview switch
    expect(screen.queryByRole("button", { name: "Bölümler" })).toBeNull()
    expect(screen.queryByRole("radio", { name: "Önizle" })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Bölümlere dön" }))
    expect(screen.queryByRole("region")).toBeNull()
  })

  it("puts the parts in a drawer beside the open settings on a laptop", async () => {
    windowOf(1100)
    renderEditor()
    const tree = await opened()
    await userEvent.click(within(tree).getByRole("button", { name: "Giriş" }))

    // The settings take the list's place; the list opens over them
    expect(settings()).toBeVisible()
    expect(screen.queryByRole("navigation", { name: "Sayfanın bölümleri" })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Bölümler" }))
    const drawer = await screen.findByRole("dialog", { name: "Sayfanın bölümleri" })
    const list = within(drawer).getByRole("navigation", { name: "Sayfanın bölümleri" })
    // A row's own buttons work in the drawer, which stays open
    await userEvent.click(
      within(list).getByRole("button", { name: "Blog yazıları bölümünü gizle" })
    )
    expect(drawer).toBeVisible()

    // Another part picked: its settings open, the drawer closes
    await userEvent.click(within(list).getByRole("button", { name: "Tema ayarları" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    expect(screen.getByRole("region", { name: "Tema ayarları" })).toBeVisible()
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
