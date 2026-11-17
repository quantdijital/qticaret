import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { bridgeMessage } from "@qticaret/types/editor-bridge"
import { PATH, holdClock, opened, releaseClock, renderEditor, serve } from "./theme-editor.fixtures"
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

const STORE = "qticaret.editor.sidebar.v1"
const ORIGIN = "http://localhost:8000"
const SESSION = "/onizleme/sfs_0123456789abcdef0123456789abcdef.abc.mac"

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

const hide = () => screen.getByRole("button", { name: "Kenar çubuğunu gizle" })
const show = () => screen.getByRole("button", { name: "Kenar çubuğunu göster" })
const sidebar = () => document.getElementById("editor-sidebar")
const settings = () => screen.getByRole("region", { name: "Giriş" })

describe("the theme editor's side panel toggle", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    serve(fetchMock, admin)
  })
  afterEach(() => {
    Reflect.deleteProperty(window, "matchMedia")
    window.localStorage.removeItem(STORE)
  })

  it("folds the parts and the settings away and back, keeping what is open", async () => {
    windowOf(1440)
    renderEditor()
    const tree = await opened()
    await userEvent.click(within(tree).getByRole("button", { name: "Giriş" }))
    const panel = settings()

    const toggle = hide()
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(toggle).toHaveAttribute("aria-controls", "editor-sidebar")
    expect(sidebar()).toContainElement(tree)
    expect(sidebar()).toContainElement(panel)

    await userEvent.click(toggle)
    expect(sidebar()).not.toBeVisible()
    expect(show()).toHaveAttribute("aria-expanded", "false")
    expect(window.localStorage.getItem(STORE)).toBe("hidden")

    // Back as it was: the same settings, not drawn afresh
    await userEvent.click(show())
    expect(sidebar()).toBeVisible()
    expect(settings()).toBe(panel)
    expect(window.localStorage.getItem(STORE)).toBeNull()
  })

  it("remembers the choice in this browser", async () => {
    windowOf(1440)
    window.localStorage.setItem(STORE, "hidden")
    renderEditor()
    await screen.findByTitle("Vitrin önizlemesi")
    expect(show()).toHaveAttribute("aria-expanded", "false")
    expect(sidebar()).not.toBeVisible()
  })

  it("folds the settings beside the preview on a laptop too, and toggles with ⌘\\ / Ctrl+\\", async () => {
    windowOf(1100)
    renderEditor()
    await opened()
    expect(sidebar()).toBeVisible()

    fireEvent.keyDown(window, { key: "\\", metaKey: true })
    expect(sidebar()).not.toBeVisible()
    fireEvent.keyDown(window, { key: "\\", ctrlKey: true })
    expect(sidebar()).toBeVisible()
    // Without the modifier, or a keydown without a key (autofill), nothing changes
    fireEvent.keyDown(window, { key: "\\" })
    fireEvent.keyDown(window, {})
    expect(sidebar()).toBeVisible()
  })

  it("offers no toggle on a phone, where the edit-or-preview switch stands for it", async () => {
    windowOf(390)
    window.localStorage.setItem(STORE, "hidden")
    renderEditor()
    const tree = await opened()
    expect(screen.queryByRole("button", { name: /Kenar çubuğunu/ })).toBeNull()
    // A choice made on a wider screen does not hide the phone's settings
    expect(tree).toBeVisible()
    fireEvent.keyDown(window, { key: "\\", metaKey: true })
    expect(tree).toBeVisible()
    expect(window.localStorage.getItem(STORE)).toBe("hidden")
  })
})

describe("the folded side panel and the live preview", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    serve(fetchMock, admin)
    const rest = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((url: string, init?: Init) => {
      if (url === `${PATH}/editor-session`) {
        return Promise.resolve({
          id: "ses1",
          idle_ms: 30 * 60_000,
          url: SESSION,
          path: SESSION,
          expires_at: "2026-11-15T20:00:00.000Z",
        })
      }
      if (url.startsWith(`${PATH}/editor-session/`)) {
        return Promise.resolve({ renewed: true, deleted: true })
      }
      return rest ? rest(url, init) : Promise.reject(new Error(url))
    })
  })
  afterEach(() => {
    releaseClock()
    window.localStorage.removeItem(STORE)
  })

  it("comes back when a section is picked in the preview, even the one already open", async () => {
    const user = holdClock()
    window.localStorage.setItem(STORE, "hidden")
    renderEditor()
    const frame = await screen.findByTitle<HTMLIFrameElement>("Vitrin önizlemesi")
    await waitFor(() => {
      expect(frame).toHaveAttribute("src", `${ORIGIN}${SESSION}`)
    })
    const target = frame.contentWindow
    if (!target) {
      throw new Error("the frame has no window")
    }
    vi.spyOn(target, "postMessage").mockImplementation(() => undefined)
    const fromFrame = (data: unknown) => {
      act(() => {
        window.dispatchEvent(new MessageEvent("message", { origin: ORIGIN, source: target, data }))
      })
    }
    fromFrame(bridgeMessage("ready", { v: 1, path: "/", edition: null }, 0))
    expect(sidebar()).not.toBeVisible()

    frame.focus()
    fromFrame(bridgeMessage("click", { id: "yeniurunler" }, 1))
    await waitFor(() => {
      expect(sidebar()).toBeVisible()
    })

    // Folded again over the same section, the same label brings it back
    await user.click(hide())
    expect(sidebar()).not.toBeVisible()
    frame.focus()
    fromFrame(bridgeMessage("click", { id: "yeniurunler" }, 2))
    await waitFor(() => {
      expect(sidebar()).toBeVisible()
    })
  })
})
