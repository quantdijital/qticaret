import { act, screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { bridgeMessage } from "@qticaret/types/editor-bridge"
import type { ToStorefrontMessage } from "@qticaret/types/editor-bridge"
import {
  PATH,
  holdClock,
  lastSaved,
  opened,
  pass,
  postsTo,
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

const ORIGIN = "http://localhost:8000"
const SESSION = "/onizleme/sfs_0123456789abcdef0123456789abcdef.abc.mac"

/** The fixture's server, with the live preview session (adr/0065 §1) on top. */
function serveLive() {
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
}

let user: UserEvent

describe("the theme editor on the live preview (adr/0065 Faz 1)", () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    serveLive()
  })
  afterEach(() => {
    releaseClock()
  })

  it("redraws the frame in place after a save and scrolls to a section just added", async () => {
    renderEditor()
    await opened()
    const frame = await screen.findByTitle<HTMLIFrameElement>("Vitrin önizlemesi")
    await waitFor(() => {
      expect(frame).toHaveAttribute("src", `${ORIGIN}${SESSION}`)
    })
    const target = frame.contentWindow
    if (!target) {
      throw new Error("the frame has no window")
    }
    const spy = vi.spyOn(target, "postMessage").mockImplementation(() => undefined)
    const posted = (type: ToStorefrontMessage["type"]) =>
      spy.mock.calls
        .map(([message]) => message as ToStorefrontMessage)
        .filter((message) => message.type === type)
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: ORIGIN,
          source: target,
          data: bridgeMessage("ready", { v: 1, path: "/", edition: null }, 0),
        })
      )
    })
    expect(posted("init")).toHaveLength(1)

    // One click: saved at once, then the frame redraws in place
    await user.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    await pass(0)
    await waitFor(() => {
      expect(posted("refresh")).toHaveLength(1)
    })
    expect(postsTo(fetchMock)).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "Bölüm ekle" }))
    const chooser = await screen.findByRole("dialog", { name: "Bölüm ekle" })
    await user.click(within(chooser).getByRole("button", { name: /Metin/ }))
    await pass(0)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.home.at(-1)?.type).toBe("rich_text")
    })
    const added = lastSaved(fetchMock)?.home.at(-1)?.id
    // The new section is scrolled to whatever the view; the bridge holds it until drawn
    expect(posted("select")).toContainEqual(
      expect.objectContaining({ payload: { id: added, reveal: "always", flash: true } })
    )
    await waitFor(() => {
      expect(posted("refresh").length).toBeGreaterThanOrEqual(2)
    })

    // Same address throughout, no signed link asked for, nothing sent to "*"
    expect(frame).toHaveAttribute("src", `${ORIGIN}${SESSION}`)
    expect(screen.getByTitle("Vitrin önizlemesi")).toBe(frame)
    expect(fetchMock.mock.calls.filter(([url]) => url === `${PATH}/preview`)).toEqual([])
    expect(new Set(spy.mock.calls.map(([, to]) => to))).toEqual(new Set([ORIGIN]))
  })

  it("opens a section from the preview's edit label and follows a link inside it (Faz 2)", async () => {
    renderEditor()
    await opened()
    const frame = await screen.findByTitle<HTMLIFrameElement>("Vitrin önizlemesi")
    await waitFor(() => {
      expect(frame).toHaveAttribute("src", `${ORIGIN}${SESSION}`)
    })
    const target = frame.contentWindow
    if (!target) {
      throw new Error("the frame has no window")
    }
    const spy = vi.spyOn(target, "postMessage").mockImplementation(() => undefined)
    const posted = (type: ToStorefrontMessage["type"]) =>
      spy.mock.calls
        .map(([message]) => message as ToStorefrontMessage)
        .filter((message) => message.type === type)
    const fromFrame = (data: unknown) => {
      act(() => {
        window.dispatchEvent(new MessageEvent("message", { origin: ORIGIN, source: target, data }))
      })
    }
    fromFrame(bridgeMessage("ready", { v: 1, path: "/", edition: null }, 0))
    await waitFor(() => {
      expect(posted("labels")).toHaveLength(1)
    })
    expect(posted("labels")[0]).toMatchObject({ payload: { edit: "Düzenle" } })

    // The edit label: the section's form opens and is said aloud
    // A press in the frame moves the focus to it (the panel takes presses only then)
    frame.focus()
    fromFrame(bridgeMessage("click", { id: "yeniurunler" }, 1))
    await waitFor(() => {
      expect(screen.getByText(/^Seçildi: /)).toBeInTheDocument()
    })
    expect(posted("select")).toContainEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ id: "yeniurunler" }) as unknown,
      })
    )

    // A link followed in the frame: shown there with the draft, the frame kept
    frame.focus()
    fromFrame(bridgeMessage("navigate-request", { path: "/sepet", previewable: true }, 2))
    await waitFor(() => {
      expect(posted("navigate")).toContainEqual(
        expect.objectContaining({ payload: { page: "/sepet" } })
      )
    })
    fromFrame(bridgeMessage("location", { path: "/sepet", sections: ["mainheader"] }, 3))
    // The home section's form still open: it is not on the cart page
    expect(await screen.findByText("Bu bölüm başka bir sayfada.")).toBeInTheDocument()
    // Checkout does not open in the preview: said, nothing sent
    const navigations = posted("navigate").length
    frame.focus()
    fromFrame(bridgeMessage("navigate-request", { path: "/odeme", previewable: false }, 4))
    expect(await screen.findByText(/\/odeme önizlemede açılmaz/)).toBeInTheDocument()
    expect(posted("navigate")).toHaveLength(navigations)
    expect(screen.getByTitle("Vitrin önizlemesi")).toBe(frame)
  })
})
