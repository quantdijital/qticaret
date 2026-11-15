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

const ORIGIN = "http://localhost:8000"
const SESSION = "/onizleme/sfs_0123456789abcdef0123456789abcdef.abc.mac"
const NOT_FOUND = "Bölüm önizlemede bulunamadı."

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

/** The editor on a live frame that has said it is ready; `fromFrame` speaks as the frame. */
async function liveEditor() {
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
  let seq = 0
  const fromFrame = (type: string, payload: unknown) => {
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: ORIGIN,
          source: target,
          data: bridgeMessage(type as never, payload as never, seq++),
        })
      )
    })
  }
  fromFrame("ready", { v: 1, path: "/", edition: null })
  const selected = () =>
    spy.mock.calls
      .map(([message]) => message as ToStorefrontMessage)
      .filter((message) => message.type === "select")
      .map((message) => (message.payload as { id: string | null }).id)
  return { fromFrame, selected }
}

let user: UserEvent

describe("a section the preview does not draw (adr/0065)", () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    serveLive()
  })
  afterEach(() => {
    releaseClock()
  })

  it("says a new, still empty section shows once filled in, not that it was not found", async () => {
    const { fromFrame, selected } = await liveEditor()
    await user.click(screen.getByRole("button", { name: "Bölüm ekle" }))
    const chooser = await screen.findByRole("dialog", { name: "Bölüm ekle" })
    await user.click(within(chooser).getByRole("button", { name: /Sık sorulan sorular/ }))
    await pass(0)
    const added = selected().at(-1)
    expect(added).toBeTruthy()

    // Its question is still to write: not saved, so the frame waits and gives up
    fromFrame("missing", { id: added, reason: "timeout" })
    expect(await screen.findByText(/Bu bölüm henüz boş/)).toBeInTheDocument()
    expect(screen.queryByText(NOT_FOUND)).not.toBeInTheDocument()
  })

  it("says a shop-filled section has nothing to show, and lets go once it is drawn", async () => {
    const { fromFrame } = await liveEditor()
    await user.click(screen.getByRole("button", { name: "Blog yazıları" }))
    await pass(0)
    fromFrame("missing", { id: "blogyazilari", reason: "timeout" })
    expect(await screen.findByText(/gösterecek bir şeyi yok/)).toBeInTheDocument()
    expect(screen.queryByText(NOT_FOUND)).not.toBeInTheDocument()

    // A later redraw brings it: the notice goes
    fromFrame("location", { path: "/", sections: ["girisbolumu", "blogyazilari"] })
    await waitFor(() => {
      expect(screen.queryByText(/gösterecek bir şeyi yok/)).not.toBeInTheDocument()
    })
  })

  it("still says a section that should be drawn was not found", async () => {
    const { fromFrame } = await liveEditor()
    await user.click(screen.getByRole("button", { name: "Giriş" }))
    await pass(0)
    fromFrame("missing", { id: "girisbolumu", reason: "timeout" })
    expect(await screen.findByText(NOT_FOUND)).toBeInTheDocument()
  })
})
