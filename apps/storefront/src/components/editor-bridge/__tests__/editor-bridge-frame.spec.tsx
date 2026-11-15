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
    // The editor's keys, Faz 2's Alt+↓/↑ through the sections and Enter in a search field
    expect(listening().sort()).toEqual(["keydown", "keydown", "keydown", "message"])
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }))
    })
    expect(types(posted)).toEqual(["ready", "location", "key"])
    expect(posted.mock.calls[2]?.[0]).toMatchObject({ payload: { key: "undo" } })
    for (const [, target] of posted.mock.calls) {
      expect(target).toBe(PANEL)
    }
  })

  it("outside a frame puts nothing of the editor in the page", () => {
    // Its own top window, as a page opened on its own is
    Object.defineProperty(window, "parent", { value: window, configurable: true })
    mount()
    expect(document.querySelector("qt-editor-layer")).toBeNull()
    expect(document.documentElement.hasAttribute("data-qt-editor")).toBe(false)
  })

  it("framed, marks the page and adds its own layer, both gone when it unmounts", () => {
    framed()
    mount()
    expect(document.documentElement.hasAttribute("data-qt-editor")).toBe(true)
    expect(document.querySelectorAll("qt-editor-layer")).toHaveLength(1)
    act(() => {
      root.unmount()
    })
    root = createRoot(host)
    expect(document.querySelector("qt-editor-layer")).toBeNull()
    expect(document.documentElement.hasAttribute("data-qt-editor")).toBe(false)
  })

  it("holds a link in the preview and asks the panel for its page (Faz 2)", () => {
    const posted = framed()
    mount()
    const shop = link("/urun/sef-bicagi?renk=siyah#yorum")
    const checkout = link("/odeme")
    const away = link("https://evil.example/x")
    const clicks = [shop, checkout, away].map((anchor) => click(anchor))
    expect(clicks).toEqual([false, false, false])
    const asked = posted.mock.calls
      .map(([message]) => message as { type: string; payload: unknown })
      .filter((message) => message.type === "navigate-request")
      .map((message) => message.payload)
    expect(asked).toEqual([
      { path: "/urun/sef-bicagi?renk=siyah", previewable: true },
      { path: "/odeme", previewable: false },
    ])
  })

  it("holds a search in the preview: the results page is asked for", () => {
    const posted = framed()
    mount()
    const form = document.createElement("form")
    form.setAttribute("action", "/arama")
    form.setAttribute("method", "get")
    const field = document.createElement("input")
    field.name = "q"
    field.value = "bıçak"
    form.append(field)
    host.append(form)
    const submit = new Event("submit", { bubbles: true, cancelable: true })
    act(() => {
      form.dispatchEvent(submit)
    })
    expect(submit.defaultPrevented).toBe(true)
    expect(posted.mock.calls.at(-1)?.[0]).toMatchObject({
      type: "navigate-request",
      payload: { path: "/arama?q=b%C4%B1%C3%A7ak", previewable: true },
    })
  })
})

const types = (posted: { mock: { calls: unknown[][] } }) =>
  posted.mock.calls.map(([message]) => (message as { type: string }).type)

function link(href: string) {
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.textContent = href
  host.append(anchor)
  return anchor
}

/** Clicks like a person; true when nothing held it. */
function click(element: Element) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
  act(() => {
    element.dispatchEvent(event)
  })
  return !event.defaultPrevented
}
