// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EditorBridge } from "../editor-bridge"

/**
 * The bridge in the preview frame (adr/0065 §2; security review
 * 2026-11-15): outside a frame it sets up nothing, not even a listener;
 * framed, it writes to the panel's exact origin only, never `*`.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => `/onizleme/sfs_${"0".repeat(32)}.abc.mac`,
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const PANEL = "https://panel.example.com"

let host: HTMLDivElement
let root: Root
let addListener: { mock: { calls: unknown[][] } }
/** The window events the bridge listened to. */
const listening = () =>
  addListener.mock.calls
    .map(([type]) => type)
    .filter((type) => type === "message" || type === "keydown")

beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  addListener = vi.spyOn(window, "addEventListener")
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  host.remove()
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, "parent")
})

function mount(panelOrigin = PANEL) {
  act(() => {
    root.render(<EditorBridge panelOrigin={panelOrigin} edition={null} nonce={undefined} />)
  })
}

/** The page as a frame's: its parent another window that records what is posted to it. */
function framed() {
  const postMessage = vi.fn()
  Object.defineProperty(window, "parent", { value: { postMessage }, configurable: true })
  return postMessage
}

describe("the editor bridge in the preview frame", () => {
  it("sets up nothing outside a frame: no listener, no message", () => {
    expect(window.parent).toBe(window)
    const posted = vi.spyOn(window, "postMessage")
    mount()
    expect(listening()).toEqual([])
    expect(posted).not.toHaveBeenCalled()
  })

  it("sets up nothing without the panel's origin", () => {
    const posted = framed()
    mount("")
    expect(listening()).toEqual([])
    expect(posted).not.toHaveBeenCalled()
  })

  it("framed, writes to the panel's exact origin only, never '*'", () => {
    const posted = framed()
    mount()
    expect(listening().sort()).toEqual(["keydown", "message"])
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }))
    })
    expect(posted.mock.calls.map(([message]) => (message as { type: string }).type)).toEqual([
      "ready",
      "key",
    ])
    expect(posted.mock.calls[1]?.[0]).toMatchObject({ payload: { key: "undo" } })
    for (const [, target] of posted.mock.calls) {
      expect(target).toBe(PANEL)
    }
  })
})
